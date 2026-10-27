import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).resolve().parents[2]/'qwen-server/run_proxy.py'),run_name='__main__')
