"""Canonical loopback-only, no-model-start runtime and bounded origin protection."""
import asyncio  # Import before the spawn prohibition; Windows asyncio subclasses Popen.
import collections
import hmac
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

def forbid_startup(*args, **kwargs):
    raise RuntimeError('Model/process startup forbidden in the AI proxy')

subprocess.Popen = forbid_startup
spec = importlib.util.spec_from_file_location('interviewiq_qwen_production', ROOT / 'app.py')
production = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)

ensure_ready_without_start = production.ensure_llama_server
production.QWEN_MODEL_REPO = os.getenv('QWEN_MODEL_REPO', 'ggml-org/Qwen3-1.7B-GGUF')
production.QWEN_CONTEXT_SIZE = 4096
production.LLAMA_HOST = '127.0.0.1'
production.LLAMA_PORT = 8080
app = production.app

@app.get('/controlled-test-safety')
def controlled_test_safety():
    return {'testAdapter':'no-start-proxy-v1','proxyPid':os.getpid(),
            'modelStartupForbidden': production.ensure_llama_server is ensure_ready_without_start
                and production.subprocess.Popen is forbid_startup,
            'ownsModelHandle': production.llama_process is not None}

class ProtectedProxy:
    def __init__(self, inner, token='', require_auth=True, max_inflight=2, per_minute=12):
        if (require_auth or token) and len(token) < 32:
            raise ValueError('Configure QWEN_PROXY_API_KEY with at least 32 characters')
        self.inner, self.token = inner, token
        self.require_auth = require_auth or bool(token)
        self.active, self.recent = 0, collections.deque()
        self.max_inflight, self.per_minute = max_inflight, per_minute

    async def reply(self, send, status, body):
        await send({'type':'http.response.start','status':status,'headers':[(b'content-type',b'application/json')]})
        await send({'type':'http.response.body','body':json.dumps(body).encode()})

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.inner(scope, receive, send)
        headers = dict(scope.get('headers', []))
        supplied = headers.get(b'authorization', b'').decode('latin1')
        if self.require_auth and not hmac.compare_digest(supplied.encode(), ('Bearer '+self.token).encode()):
            return await self.reply(send,401,{'detail':'Unauthorized'})
        path = scope.get('path','')
        if path == '/runtime-status':
            return await self.reply(send,200,{'runtimeVersion':'hybrid-v1','authenticationRequired':self.require_auth,
                'modelStartupForbidden':True,'maxInflight':self.max_inflight,'requestsPerMinute':self.per_minute})
        if path not in ['/health','/generate','/controlled-test-safety','/']:
            return await self.reply(send,404,{'detail':'Not found'})
        if path != '/generate':
            return await self.inner(scope, receive, send)
        now=time.monotonic()
        while self.recent and now-self.recent[0]>=60: self.recent.popleft()
        if self.active>=self.max_inflight or len(self.recent)>=self.per_minute:
            return await self.reply(send,429,{'detail':'AI request capacity exceeded'})
        self.active+=1
        self.recent.append(now)
        try:
            # Read at most 1 MiB before entering FastAPI; never log body contents.
            body=bytearray()
            while True:
                message=await receive()
                if message['type']=='http.disconnect': return
                chunk=message.get('body',b'')
                if len(body)+len(chunk)>1048576:
                    return await self.reply(send,413,{'detail':'AI request too large'})
                body.extend(chunk)
                if not message.get('more_body',False): break
            sent=False
            async def replay():
                nonlocal sent
                if not sent:
                    sent=True
                    return {'type':'http.request','body':bytes(body),'more_body':False}
                return await receive()
            return await self.inner(scope,replay,send)
        finally:
            self.active-=1

def create_app(local_only=False):
    token=os.getenv('QWEN_PROXY_API_KEY','').strip()
    return ProtectedProxy(app,token,require_auth=not local_only)
