import os
import uuid
from datetime import datetime, timezone
import ctypes
import hashlib
import json
import shutil
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

from runtime_config import PROJECT_ROOT, load_local_env, model_path, executable_path, verify_files, build_command, abort_reason, preflight_passes
ROOT = None
STATE = None
MODEL = None
EXE = None

class Memory(ctypes.Structure):
    _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [(name, ctypes.c_ulonglong) for name in ['total', 'available', 'pageTotal', 'pageAvailable', 'virtualTotal', 'virtualAvailable', 'extended']]

def resources():
    memory = Memory()
    memory.length = ctypes.sizeof(memory)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
        raise RuntimeError('Memory inspection failed')
    output = subprocess.check_output([shutil.which('nvidia-smi'), '--query-gpu=memory.total,memory.used,temperature.gpu,utilization.gpu', '--format=csv,noheader,nounits'], text=True, timeout=5, creationflags=subprocess.CREATE_NO_WINDOW)
    total, used, temperature, utilization = [int(value.strip()) for value in output.strip().split(',')]
    return {'availableGiB': memory.available / 1024**3, 'ramLoadPercent': memory.load, 'vramTotalMiB': total, 'vramUsedMiB': used, 'temperatureC': temperature, 'gpuUtilizationPercent': utilization}

def write(state):
    temporary = STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, indent=2), encoding='utf-8')
    temporary.replace(STATE)

def main():
    global ROOT, STATE, MODEL, EXE
    load_local_env()
    MODEL, EXE = model_path(), executable_path()
    verify_files(MODEL, EXE)
    digest = 'd2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5'
    # A kernel mutex is automatically released after a monitor crash; old state never blocks startup.
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_wchar_p]
    kernel.CreateMutexW.restype = ctypes.c_void_p
    kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    mutex = kernel.CreateMutexW(None, False, 'Local\\InterviewIQ-Qwen3-1.7B-Controlled')
    if not mutex or kernel.WaitForSingleObject(mutex, 0) not in (0, 0x80):
        raise RuntimeError('Another controlled Qwen launcher is active')
    session = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    ROOT = PROJECT_ROOT / 'local-ai' / 'logs' / session
    ROOT.mkdir(parents=True, exist_ok=False)
    STATE = ROOT / 'qwen17-startup-state.json'
    print(json.dumps({'session': session, 'monitorPID': os.getpid(), 'profile': 'qwen-16layer-v1'}), flush=True)
    # tasklist is denied in this sandbox; use the permitted read-only process inventory.
    tasks = subprocess.check_output(['powershell.exe', '-NoProfile', '-Command', "Get-Process | Where-Object {$_.ProcessName -match 'llama|ollama'} | ForEach-Object {$_.ProcessName}"], text=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
    if any(name in tasks.lower() for name in ['llama-server', 'llama-cli', 'ollama']):
        raise RuntimeError('Existing inference process detected')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 8080))
    devices = subprocess.check_output([str(EXE), '--list-devices'], text=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
    if 'Vulkan1: NVIDIA GeForce RTX 3060 Laptop GPU' not in devices:
        raise RuntimeError('Approved Vulkan1 device is unavailable')
    baseline = resources()
    if not preflight_passes(baseline):
        write({'status': 'blocked_before_start', 'baseline': baseline})
        print(json.dumps({'status': 'blocked_before_start', 'resources': baseline}), flush=True)
        raise SystemExit(2)
    command = build_command(EXE, MODEL)
    started = time.monotonic()
    with (ROOT / 'qwen17-model.log').open('xb') as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
        state = {'status': 'starting', 'modelPID': process.pid, 'modelSHA256': digest, 'command': command, 'baseline': baseline, 'samples': [], 'monitorPID': os.getpid(), 'monitoring': 'resources-only'}
        ready_at = None
        try:
            write(state)
            while True:
                if (ROOT / 'stop.request').exists():
                    raise RuntimeError('Operator requested shutdown')
                if process.poll() is not None:
                    raise RuntimeError('Owned model process exited: ' + str(process.returncode))
                sample = resources()
                sample['elapsedSeconds'] = round(time.monotonic() - started, 2)
                state['samples'].append(sample)
                # Retain the startup trace and a bounded recent monitoring tail.
                if len(state['samples']) > 1800:
                    state['samples'].pop(300)
                state['latest'] = sample
                reason = abort_reason(sample, baseline, ready_at is not None)
                if reason: raise RuntimeError(reason)
                if ready_at is None:
                    try:
                        with urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=1) as response:
                            if response.status == 200:
                                ready_at = time.monotonic()
                                state['startupSeconds'] = round(ready_at - started, 2)
                                state['status'] = 'ready_observing'
                                print(json.dumps({'status': 'ready_observing', 'modelPID': process.pid, 'startupSeconds': state['startupSeconds']}), flush=True)
                    except Exception:
                        pass
                    if ready_at is None and time.monotonic() - started > 120:
                        raise RuntimeError('Readiness timeout: 120 seconds')
                if ready_at is not None:
                    if sample['availableGiB'] < 3:
                        raise RuntimeError('Post-load 3 GiB reserve not met')
                    if time.monotonic() - ready_at >= 30 and state['status'] != 'stable_monitoring':
                        state['status'] = 'stable_monitoring'
                        state['stableAfterSeconds'] = round(time.monotonic() - ready_at, 2)
                        state['stableResources'] = sample
                        print(json.dumps({'status': 'stable_monitoring', 'modelPID': process.pid, 'resources': sample}), flush=True)
                state['latest'] = sample
                write(state)
                time.sleep(2)
        except BaseException as error:
            # Popen retains the exact owned process handle; never terminate by name or port.
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            state['status'] = 'stopped'
            state['reason'] = str(error)
            write(state)
            raise

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'controlledStartup': 'failed', 'reason': str(error)}), flush=True)
        raise SystemExit(1)
