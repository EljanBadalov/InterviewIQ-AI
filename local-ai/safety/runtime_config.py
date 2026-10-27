"""Project-relative configuration. Secrets never leave the child process environment."""
import hashlib
import os
from pathlib import Path
import shutil

PROJECT_ROOT=Path(__file__).resolve().parents[2]
MODEL_SHA256='d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5'
MODEL_BYTES=1282439264
EXE_SHA256='eba08aa1a6ad397e8954874ca58f62271cf15ab45a85d6f1f59176a47cabd6c2'

def load_local_env():
    file=PROJECT_ROOT/'local-ai'/'.env'
    if file.exists():
        for line in file.read_text(encoding='utf-8-sig').splitlines():
            line=line.strip()
            if not line or line.startswith('#'): continue
            key,sep,value=line.partition('=')
            if not sep or not key.strip().replace('_','').isalnum(): raise ValueError('Invalid local configuration')
            os.environ.setdefault(key.strip(),value.strip().strip('"').strip("'"))

def model_path():
    value=Path(os.getenv('QWEN_MODEL_PATH','local-ai/models/Qwen3-1.7B-Q4_K_M.gguf'))
    return (value if value.is_absolute() else PROJECT_ROOT/value).resolve()

def executable_path():
    configured=os.getenv('LLAMA_SERVER_PATH')
    if configured:
        value=Path(configured)
        return (value if value.is_absolute() else PROJECT_ROOT/value).resolve()
    winget=Path(os.getenv('LOCALAPPDATA',''))/'Microsoft/WinGet/Packages/ggml.llamacpp_Microsoft.Winget.Source_8wekyb3d8bbwe/llama-server.exe'
    if winget.is_file(): return winget
    found=shutil.which('llama-server')
    if not found: raise FileNotFoundError('Install the verified llama.cpp Vulkan build or configure LLAMA_SERVER_PATH')
    return Path(found).resolve()

def verify_files(model, executable):
    for file,expected,size in [(model,MODEL_SHA256,MODEL_BYTES),(executable,EXE_SHA256,None)]:
        if not file.is_file() or (size is not None and file.stat().st_size!=size):
            raise ValueError('Required runtime file is missing or has an unexpected size')
        with file.open('rb') as stream: actual=hashlib.file_digest(stream,'sha256').hexdigest()
        if actual!=expected: raise ValueError('Runtime integrity verification failed')

def build_command(executable, model):
    return [str(executable),'-m',str(model),'--host','127.0.0.1','--port','8080','--device','Vulkan1',
            '--gpu-layers','16','--ctx-size','4096','--parallel','1','--threads','2','--threads-batch','2',
            '--batch-size','128','--ubatch-size','64','--cache-type-k','f16','--cache-type-v','f16',
            '--fit','off','--jinja','--no-warmup']

def abort_reason(sample, baseline, ready=False):
    if sample['availableGiB']<2.5 or sample['vramUsedMiB']>=4915 or sample['temperatureC']>=min(75,baseline['temperatureC']+15):
        return 'Resource abort threshold reached'
    if ready and sample['availableGiB']<3: return 'Post-load 3 GiB reserve not met'
    return None

def preflight_passes(sample):
    return sample['availableGiB']>=6.5 and sample['vramTotalMiB']-sample['vramUsedMiB']>=3072 and sample['temperatureC']<60
