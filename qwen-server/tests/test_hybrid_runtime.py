"""No sockets, model processes, database connections, or inference in these tests."""
import asyncio
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch, Mock

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'qwen-server'))
sys.path.insert(0,str(ROOT/'local-ai/safety'))
with patch('subprocess.Popen'), patch('requests.sessions.Session.request',side_effect=AssertionError('Network forbidden')):
    import local_runtime as runtime
import runtime_config as config

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.calls=0
    async def inner(self,scope,receive,send):
        self.calls+=1
        await receive()
        await send({'type':'http.response.start','status':200,'headers':[]})
        await send({'type':'http.response.body','body':b'{}'})
    async def request(self,proxy,token=None,body=b'{}',path='/generate'):
        response=[];used=False
        async def receive():
            nonlocal used
            if not used: used=True;return {'type':'http.request','body':body,'more_body':False}
            return {'type':'http.disconnect'}
        async def send(message): response.append(message)
        headers=[] if token is None else [(b'authorization',('Bearer '+token).encode())]
        await proxy({'type':'http','path':path,'method':'POST','headers':headers},receive,send)
        return next(m['status'] for m in response if m['type']=='http.response.start')
    def test_unauthorized_request_cannot_reach_generation(self):
        proxy=runtime.ProtectedProxy(self.inner,'x'*32)
        for token in [None,'wrong']:
            self.assertEqual(asyncio.run(self.request(proxy,token)),401)
        self.assertEqual(self.calls,0)
    def test_authorized_request_works_and_admin_paths_are_denied(self):
        proxy=runtime.ProtectedProxy(self.inner,'x'*32)
        self.assertEqual(asyncio.run(self.request(proxy,'x'*32)),200)
        self.assertEqual(asyncio.run(self.request(proxy,'x'*32,path='/docs')),404)
        self.assertEqual(self.calls,1)
    def test_body_limit_and_rate_limit(self):
        proxy=runtime.ProtectedProxy(self.inner,'x'*32,per_minute=1)
        self.assertEqual(asyncio.run(self.request(proxy,'x'*32,b'x'*1048577)),413)
        self.assertEqual(self.calls,0);self.assertEqual(proxy.active,0)
        self.assertEqual(asyncio.run(self.request(proxy,'x'*32)),429)
    def test_inflight_limit(self):
        proxy=runtime.ProtectedProxy(self.inner,'x'*32);proxy.active=2
        self.assertEqual(asyncio.run(self.request(proxy,'x'*32)),429);self.assertEqual(self.calls,0)
    def test_secret_is_required_for_hybrid_even_when_local_only_has_weak_key(self):
        for token in ['', 'short']:
            with self.assertRaises(ValueError): runtime.ProtectedProxy(self.inner,token)
        with self.assertRaises(ValueError): runtime.ProtectedProxy(self.inner,'short',require_auth=False)
    def test_proxy_never_starts_an_unavailable_model(self):
        prod=runtime.production
        with patch.object(prod,'is_llama_ready',return_value=False),patch.object(prod,'start_llama_server') as startup,patch.object(prod.requests,'post') as inference:
            with self.assertRaises(Exception) as error: prod.generate(prod.GenerateRequest(message='fixture'))
            self.assertEqual(error.exception.status_code,503)
            startup.assert_not_called();inference.assert_not_called()
    def test_validated_gpu_command_and_threshold_boundaries_are_unchanged(self):
        cmd=config.build_command('exe','model')
        for key,value in {'--gpu-layers':'16','--ctx-size':'4096','--parallel':'1','--threads':'2','--threads-batch':'2','--batch-size':'128','--ubatch-size':'64','--cache-type-k':'f16','--cache-type-v':'f16','--device':'Vulkan1'}.items():
            self.assertEqual(cmd[cmd.index(key)+1],value)
        self.assertIn('--no-warmup',cmd)
        sample={'availableGiB':6.5,'vramTotalMiB':6144,'vramUsedMiB':0,'temperatureC':45}
        self.assertTrue(config.preflight_passes(sample));self.assertFalse(config.preflight_passes({**sample,'availableGiB':6.499}))
        self.assertIsNone(config.abort_reason({**sample,'availableGiB':3},sample,True))
        self.assertIsNotNone(config.abort_reason({**sample,'availableGiB':2.99},sample,True))
        self.assertIsNotNone(config.abort_reason({**sample,'availableGiB':2.49},sample))
        self.assertIsNotNone(config.abort_reason({**sample,'vramUsedMiB':4915},sample))
        self.assertIsNotNone(config.abort_reason({**sample,'temperatureC':60},sample))
    def test_integrity_failure_is_not_bypassed(self):
        fake=Mock();fake.is_file.return_value=True;fake.stat.return_value.st_size=123
        with self.assertRaises(ValueError): config.verify_files(fake,fake)
    def test_relative_runtime_paths_resolve_from_project_not_working_directory(self):
        with patch.dict('os.environ',{'LLAMA_SERVER_PATH':'tools/llama-server.exe','QWEN_MODEL_PATH':'local-ai/models/Qwen3-1.7B-Q4_K_M.gguf'}):
            self.assertEqual(config.executable_path(),(ROOT/'tools/llama-server.exe').resolve())
            self.assertEqual(config.model_path(),(ROOT/'local-ai/models/Qwen3-1.7B-Q4_K_M.gguf').resolve())
    def test_monitor_import_never_runs_startup(self):
        spec=importlib.util.spec_from_file_location('safe_monitor_import_test',ROOT/'local-ai/safety/qwen_monitor.py')
        module=importlib.util.module_from_spec(spec)
        with patch('subprocess.Popen',side_effect=AssertionError('Forbidden')):
            spec.loader.exec_module(module)
        self.assertIsNone(module.STATE)

    def test_authenticated_asgi_pipeline_preserves_proxy_contract_without_real_inference(self):
        response=Mock(status_code=200)
        response.json.return_value={'choices':[{'message':{'content':'{"fixture":true}'},'finish_reason':'stop'}],
                                    'usage':{'prompt_tokens':12,'completion_tokens':4}}
        async def run():
            proxy=runtime.ProtectedProxy(runtime.app,'x'*32)
            used=False;messages=[]
            async def receive():
                nonlocal used
                if not used:
                    used=True
                    return {'type':'http.request','body':b'{"message":"synthetic fixture"}','more_body':False}
                await asyncio.Event().wait()
            async def send(message):messages.append(message)
            scope={'type':'http','http_version':'1.1','method':'POST','scheme':'http','path':'/generate',
                   'root_path':'','query_string':b'','headers':[(b'authorization',b'Bearer '+b'x'*32),(b'content-type',b'application/json')],
                   'server':('127.0.0.1',8000),'client':('127.0.0.1',1234)}
            await proxy(scope,receive,send)
            self.assertEqual(next(m['status'] for m in messages if m['type']=='http.response.start'),200)
            body=json.loads(b''.join(m.get('body',b'') for m in messages if m['type']=='http.response.body'))
            self.assertEqual(body['response'],'{"fixture":true}')
            self.assertTrue(body['diagnostics']['inferenceDispatched']);self.assertEqual(body['finish_reason'],'stop')
        with patch.object(runtime.production,'is_llama_ready',return_value=True),patch.object(runtime.production.requests,'post',return_value=response) as dispatch,patch('requests.sessions.Session.request',side_effect=AssertionError('Real network forbidden')):
            asyncio.run(run());self.assertEqual(dispatch.call_count,1)

if __name__=='__main__': unittest.main()
