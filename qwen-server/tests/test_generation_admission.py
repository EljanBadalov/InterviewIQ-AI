"""Offline boundary tests. Model startup and every real network operation fail closed."""
import ast
import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import patch, Mock
import anyio
import fastapi
import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'qwen-server'))
from generation_boundary import GenerationBudget, GenerationExpired
spec = importlib.util.spec_from_file_location('qwen_adapter_test', ROOT / 'qwen-server/app.py')
app = importlib.util.module_from_spec(spec)
with patch('subprocess.Popen', side_effect=AssertionError('Model startup forbidden')), patch('requests.sessions.Session.request', side_effect=AssertionError('Network forbidden')):
    spec.loader.exec_module(app)


def reply(reason='stop'):
    result = Mock(status_code=200)
    result.json.return_value = {'choices': [{'message': {'content': '{"nodes":[]}'}, 'finish_reason': reason}], 'usage': {'prompt_tokens': 12, 'completion_tokens': 4}}
    return result


class AdmissionTests(unittest.TestCase):
    def setUp(self):
        self.startup = patch('subprocess.Popen', side_effect=AssertionError('Model startup forbidden'))
        self.network = patch('requests.sessions.Session.request', side_effect=AssertionError('Network forbidden'))
        self.ready = patch.object(app, 'ensure_llama_server')
        self.startup.start(); self.network.start(); self.ensure = self.ready.start()
        self.addCleanup(self.startup.stop); self.addCleanup(self.network.stop); self.addCleanup(self.ready.stop)
        app.generation_lock = threading.Lock()

    def test_expired_request_never_checks_readiness_or_dispatches(self):
        with patch.object(app.requests, 'post') as dispatch:
            with self.assertRaises(fastapi.HTTPException) as error:
                app.generate(app.GenerateRequest(message='fixture', deadline_unix_ms=int(time.time()*1000)-1))
            self.assertEqual(error.exception.status_code, 504)
            self.ensure.assert_not_called(); dispatch.assert_not_called()

    def test_queue_wait_is_bounded_and_does_not_unlock_another_request(self):
        app.generation_lock.acquire()
        try:
            with patch.object(app.requests, 'post') as dispatch:
                with self.assertRaises(fastapi.HTTPException):
                    app.generate(app.GenerateRequest(message='fixture', request_budget_ms=15))
                dispatch.assert_not_called(); self.assertTrue(app.generation_lock.locked())
        finally:
            app.generation_lock.release()

    def test_readiness_consuming_budget_prevents_inference(self):
        self.ensure.side_effect = lambda: time.sleep(.015)
        with patch.object(app.requests, 'post') as dispatch:
            with self.assertRaises(fastapi.HTTPException): app.generate(app.GenerateRequest(message='fixture', request_budget_ms=5))
            dispatch.assert_not_called(); self.assertFalse(app.generation_lock.locked())

    def test_live_slot_records_wait_usage_and_finish_without_model_changes(self):
        app.generation_lock.acquire()
        release = threading.Timer(.015, app.generation_lock.release); release.start()
        try:
            with patch.object(app.requests, 'post', return_value=reply('length')) as dispatch:
                result = app.generate(app.GenerateRequest(message='fixture', max_tokens=1800, temperature=.35, top_p=.9, request_budget_ms=1000))
            self.assertEqual(result.finish_reason, 'length'); self.assertEqual(result.usage['prompt_tokens'], 12)
            self.assertGreater(result.timings_ms['queue_wait'], 5)
            self.assertLessEqual(dispatch.call_args.kwargs['timeout'], 1)
            payload = dispatch.call_args.kwargs['json']
            self.assertEqual(payload['max_tokens'], 1800); self.assertEqual(payload['temperature'], .35); self.assertEqual(payload['top_p'], .9)
            self.assertEqual(payload['chat_template_kwargs'], {'enable_thinking': False})
        finally: release.join()

    def test_disconnected_asgi_client_never_dispatches(self):
        class Client:
            async def is_disconnected(self): return True
        async def run():
            return await anyio.to_thread.run_sync(lambda: app.generate(app.GenerateRequest(message='fixture'), Client()))
        with patch.object(app.requests, 'post') as dispatch:
            with self.assertRaises(fastapi.HTTPException): anyio.run(run)
            dispatch.assert_not_called(); self.ensure.assert_not_called()

    def test_cancelled_waiter_does_not_use_a_later_slot(self):
        lock = threading.Lock(); lock.acquire(); cancelled = threading.Event()
        timer = threading.Timer(.01, cancelled.set); timer.start()
        try:
            with self.assertRaises(GenerationExpired):
                with GenerationBudget(100, cancelled=cancelled.is_set).slot(lock): self.fail('Expired waiter dispatched')
            self.assertTrue(lock.locked())
        finally: timer.join(); lock.release()

    def test_timeout_and_unknown_finish_are_safe_and_release_slot(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), patch.object(app.requests, 'post', side_effect=requests.Timeout('PRIVATE_FIXTURE_SECRET')):
            with self.assertRaises(fastapi.HTTPException): app.generate(app.GenerateRequest(message='fixture'))
        self.assertNotIn('PRIVATE_FIXTURE_SECRET', output.getvalue()); self.assertFalse(app.generation_lock.locked())
        with patch.object(app.requests, 'post', return_value=reply('PRIVATE_FIXTURE_SECRET')):
            self.assertEqual(app.generate(app.GenerateRequest(message='fixture')).finish_reason, 'unknown')

    def test_ensure_model_never_starts_an_unavailable_model(self):
        # The supported contract intentionally changed: inference runtime is independently managed.
        tree = ast.parse((ROOT / 'qwen-server/app.py').read_text(encoding='utf-8-sig'))
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'ensure_llama_server')
        self.assertFalse(any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'start_llama_server' for n in ast.walk(function)))

    def test_model_startup_and_runtime_builders_are_unchanged(self):
        old = ast.parse((ROOT / 'qwen-server/tests/fixtures/runtime_builders_before.py').read_text(encoding='utf-8-sig'))
        new = ast.parse((ROOT / 'qwen-server/app.py').read_text(encoding='utf-8-sig'))
        for name in ['build_llama_command', 'start_llama_server', 'startup_event', 'shutdown_event']:
            find = lambda tree: next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name)
            self.assertEqual(ast.dump(find(old)), ast.dump(find(new)), name)

    def test_readiness_failure_has_safe_code_and_never_dispatches(self):
        self.ensure.side_effect = RuntimeError('PRIVATE_FIXTURE_SECRET')
        output = io.StringIO()
        correlation = '11111111-2222-4333-8444-555555555555'
        with contextlib.redirect_stdout(output), patch.object(app.requests, 'post') as dispatch:
            with self.assertRaises(fastapi.HTTPException) as error:
                app.generate(app.GenerateRequest(message='PRIVATE ANSWER', system='PRIVATE PROMPT', correlation_id=correlation))
            dispatch.assert_not_called()
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(error.exception.detail['code'], 'QWEN_MODEL_UNAVAILABLE')
        self.assertEqual(error.exception.detail['stage'], 'readiness')
        self.assertFalse(error.exception.detail['inferenceDispatched'])
        self.assertIn(correlation, output.getvalue())
        for secret in ['PRIVATE_FIXTURE_SECRET', 'PRIVATE ANSWER', 'PRIVATE PROMPT']:
            self.assertNotIn(secret, output.getvalue()); self.assertNotIn(secret, str(error.exception.detail))
        self.assertFalse(app.generation_lock.locked())

    def test_transport_timeout_and_response_failure_stages(self):
        cases = [
            (requests.Timeout('PRIVATE'), 'QWEN_TIMEOUT', 'inference', 504),
            (requests.ConnectionError('PRIVATE'), 'QWEN_TRANSPORT_FAILED', 'inference', 502),
            (RuntimeError('PRIVATE'), 'QWEN_PROXY_FAILED', 'inference', 500),
        ]
        for exception, code, stage, status in cases:
            with self.subTest(code=code), patch.object(app.requests, 'post', side_effect=exception) as dispatch:
                with self.assertRaises(fastapi.HTTPException) as error:
                    app.generate(app.GenerateRequest(message='fixture'))
                self.assertEqual(error.exception.status_code, status)
                self.assertEqual(error.exception.detail['code'], code)
                self.assertEqual(error.exception.detail['stage'], stage)
                self.assertTrue(error.exception.detail['inferenceDispatched']); self.assertEqual(dispatch.call_count, 1)
                self.assertNotIn('PRIVATE', str(error.exception.detail)); self.assertFalse(app.generation_lock.locked())

    def test_invalid_empty_and_malformed_model_responses_have_bounded_codes(self):
        for body, code in [(None,'QWEN_RESPONSE_INVALID_JSON'), ([], 'QWEN_RESPONSE_INVALID_JSON'),
                           ({'choices': []}, 'QWEN_RESPONSE_EMPTY')]:
            response = reply(); response.json.return_value = body
            with self.subTest(body=body), patch.object(app.requests, 'post', return_value=response):
                with self.assertRaises(fastapi.HTTPException) as error:
                    app.generate(app.GenerateRequest(message='fixture'))
                self.assertEqual(error.exception.detail['code'], code)
                self.assertEqual(error.exception.detail['stage'], 'response')
                self.assertTrue(error.exception.detail['inferenceDispatched'])
        response = reply(); response.json.side_effect = ValueError('PRIVATE')
        with patch.object(app.requests, 'post', return_value=response):
            with self.assertRaises(fastapi.HTTPException) as error:
                app.generate(app.GenerateRequest(message='fixture'))
            self.assertEqual(error.exception.detail['code'], 'QWEN_RESPONSE_INVALID_JSON')
            self.assertNotIn('PRIVATE', str(error.exception.detail))

    def test_success_and_truncation_preserve_usage_and_dispatch_metadata(self):
        for reason in ['stop', 'length']:
            with patch.object(app.requests, 'post', return_value=reply(reason)) as dispatch:
                result = app.generate(app.GenerateRequest(message='fixture'))
                self.assertEqual(result.finish_reason, reason)
                self.assertEqual(result.diagnostics, {'stage': 'completed', 'inferenceDispatched': True})
                self.assertEqual(result.usage['prompt_tokens'], 12); self.assertEqual(dispatch.call_count, 1)

    def test_expired_queue_is_explicitly_not_dispatched(self):
        with patch.object(app.requests, 'post') as dispatch:
            with self.assertRaises(fastapi.HTTPException) as error:
                app.generate(app.GenerateRequest(message='fixture', deadline_unix_ms=int(time.time()*1000)-1))
            self.assertEqual(error.exception.detail['code'], 'GENERATION_EXPIRED')
            self.assertEqual(error.exception.detail['stage'], 'queue')
            self.assertFalse(error.exception.detail['inferenceDispatched']); dispatch.assert_not_called()


if __name__ == '__main__': unittest.main()
