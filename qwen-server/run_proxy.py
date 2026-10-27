"""Run the protected proxy without invoking production model startup hooks."""
import argparse
import json
import sys
from pathlib import Path
import uvicorn

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'qwen-server'))
sys.path.insert(0,str(ROOT/'local-ai'/'safety'))
from runtime_config import load_local_env

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--local-only',action='store_true',help='Unauthenticated loopback development only; do not tunnel')
    args=parser.parse_args()
    load_local_env()
    from local_runtime import create_app
    proxy=create_app(local_only=args.local_only)
    print(json.dumps({'proxyDiagnosticsVersion':'three-fixes-v1','runtimeVersion':'hybrid-v1',
        'noAutoStart':True,'authenticationRequired':proxy.require_auth}),flush=True)
    uvicorn.run(proxy,host='127.0.0.1',port=8000,lifespan='off',access_log=False,limit_concurrency=8)

if __name__=='__main__': main()
