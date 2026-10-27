"""Comparable direct-handler fixture; startup/network/inference are mocked."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import threading
import time
from unittest.mock import Mock, patch
import fastapi
import requests
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'qwen-server'))
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec)
    with patch('subprocess.Popen',side_effect=AssertionError('Model startup forbidden')), patch('requests.sessions.Session.request',side_effect=AssertionError('Network forbidden')): spec.loader.exec_module(module)
    return module
old=load('qwen_before',ROOT/'server/node_modules/.cache/phase4-r123/qwen-src/app.py')
new=load('qwen_after',ROOT/'qwen-server/app.py')
results={}
with contextlib.redirect_stdout(io.StringIO()):
 for label,module in [('before',old),('after',new)]:
  scenarios={}
  for scenario in ['available','expired-in-queue']:
   rows=[]
   for index in range(120):
    module.generation_lock=threading.Lock();release=None
    if scenario=='expired-in-queue':module.generation_lock.acquire();release=threading.Timer(.03,module.generation_lock.release);release.start()
    calls=[]
    def infer(*args,**kwargs):
     calls.append(1);time.sleep(.005);response=Mock(status_code=200);response.json.return_value={'choices':[{'message':{'content':'{"nodes":[]}'},'finish_reason':'stop'}],'usage':{'prompt_tokens':10,'completion_tokens':5}};response.text=json.dumps(response.json.return_value);return response
    request=module.GenerateRequest(message='fixture',request_budget_ms=5 if release else 1000)
    started=time.perf_counter();outcome='completed'
    with patch.object(module,'ensure_llama_server'),patch.object(module.requests,'post',side_effect=infer),patch('subprocess.Popen',side_effect=AssertionError('Model startup forbidden')):
     try:module.generate(request)
     except fastapi.HTTPException as error:outcome='expired' if error.status_code==504 else 'error-'+str(error.status_code)
    elapsed=(time.perf_counter()-started)*1000
    if release:release.join()
    if index>=20:rows.append({'ms':elapsed,'inferenceStubCalls':len(calls),'outcome':outcome})
   assert all(row['outcome']=='completed' for row in rows) if scenario=='available' else True
   times=sorted(row['ms'] for row in rows);scenarios[scenario]={'p50Ms':times[49],'p95Ms':times[94],'inferenceStubCallsPerRequest':rows[-1]['inferenceStubCalls'],'outcome':rows[-1]['outcome']}
  results[label]=scenarios
output={'fixture':True,'realHttp':False,'realQwen':False,'realMongo':False,'samples':100,'warmup':20,'queueHoldMs':30,'inferenceStubMs':5,'expiredBudgetMs':5,'results':results}
(ROOT/'server/docs/phase4/r1-r3/proxy-benchmark.json').write_text(json.dumps(output,indent=2))
print(json.dumps(output))
