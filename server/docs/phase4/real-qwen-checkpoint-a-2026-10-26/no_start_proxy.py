"""Compatibility import for historical launchers; canonical runtime is qwen-server/local_runtime.py."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[4]/'qwen-server'))
from local_runtime import production, forbid_startup, ensure_ready_without_start, create_app
app=create_app(local_only=True)
