import os
import subprocess
import threading
import time
from typing import Optional, Dict, Any

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


# ============================================================
# Configuration
# ============================================================

APP_HOST = os.getenv(
    "HOST",
    "0.0.0.0",
)

APP_PORT = int(
    os.getenv(
        "PORT",
        "8000",
    )
)

# llama.cpp server
LLAMA_HOST = os.getenv(
    "LLAMA_HOST",
    "127.0.0.1",
)

LLAMA_PORT = int(
    os.getenv(
        "LLAMA_PORT",
        "8080",
    )
)

LLAMA_SERVER_PATH = os.getenv(
    "LLAMA_SERVER_PATH",
    "llama-server",
)

# Qwen model
QWEN_MODEL_REPO = os.getenv(
    "QWEN_MODEL_REPO",
    "Qwen/Qwen3-4B-GGUF",
)

QWEN_MODEL_QUANT = os.getenv(
    "QWEN_MODEL_QUANT",
    "Q4_K_M",
)

# Context
QWEN_CONTEXT_SIZE = int(
    os.getenv(
        "QWEN_CONTEXT_SIZE",
        "8192",
    )
)

# Generation defaults
DEFAULT_MAX_TOKENS = int(
    os.getenv(
        "QWEN_MAX_TOKENS",
        "1024",
    )
)

DEFAULT_TEMPERATURE = float(
    os.getenv(
        "QWEN_TEMPERATURE",
        "0.6",
    )
)

DEFAULT_TOP_P = float(
    os.getenv(
        "QWEN_TOP_P",
        "0.95",
    )
)


# ============================================================
# FastAPI
# ============================================================

app = FastAPI(
    title="InterviewIQ Qwen Server",
    description="Self-hosted Qwen inference service for InterviewIQ",
    version="1.0.0",
)


# ============================================================
# Request / Response Models
# ============================================================

class GenerateRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="User message",
    )

    system: Optional[str] = Field(
        default=None,
        description="System instruction",
    )

    max_tokens: int = Field(
        default=DEFAULT_MAX_TOKENS,
        ge=1,
        le=8192,
    )

    temperature: float = Field(
        default=DEFAULT_TEMPERATURE,
        ge=0.0,
        le=2.0,
    )

    top_p: float = Field(
        default=DEFAULT_TOP_P,
        gt=0.0,
        le=1.0,
    )


class GenerateResponse(BaseModel):
    response: str
    model: str
    usage: Optional[dict] = None


# ============================================================
# Global state
# ============================================================

llama_process: Optional[subprocess.Popen] = None
llama_ready = False
llama_lock = threading.Lock()


# ============================================================
# URLs
# ============================================================

def get_llama_base_url() -> str:
    return (
        f"http://{LLAMA_HOST}:{LLAMA_PORT}"
    )


def get_llama_health_url() -> str:
    return (
        f"{get_llama_base_url()}/health"
    )


def get_llama_chat_url() -> str:
    return (
        f"{get_llama_base_url()}/v1/chat/completions"
    )


# ============================================================
# Health check
# ============================================================

def is_llama_ready() -> bool:
    try:
        response = requests.get(
            get_llama_health_url(),
            timeout=2,
        )

        return response.status_code == 200

    except requests.RequestException:
        return False


# ============================================================
# Response Extraction Helper
# ============================================================

def extract_generated_text(data: Dict[str, Any]) -> str:
    """Safely extracts text whether Qwen returns content, reasoning, or raw text."""
    choices = data.get("choices", [])
    if not choices or not isinstance(choices, list):
        return ""

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        return ""

    # Check choice.message
    message = first_choice.get("message")
    if isinstance(message, dict):
        # 1. Standard chat completion content
        content = message.get("content")
        if content and isinstance(content, str) and content.strip():
            return content.strip()

        # 2. Reasoning content fallback (Qwen thinking models)
        reasoning = message.get("reasoning_content")
        if reasoning and isinstance(reasoning, str) and reasoning.strip():
            return reasoning.strip()

    # 3. Completion choice.text fallback
    text = first_choice.get("text")
    if text and isinstance(text, str) and text.strip():
        return text.strip()

    return ""


# ============================================================
# llama.cpp startup
# ============================================================

def build_llama_command() -> list[str]:
    model_spec = (
        f"{QWEN_MODEL_REPO}:"
        f"{QWEN_MODEL_QUANT}"
    )

    command = [
        LLAMA_SERVER_PATH,

        "-hf",
        model_spec,

        "--host",
        LLAMA_HOST,

        "--port",
        str(LLAMA_PORT),

        "--ctx-size",
        str(QWEN_CONTEXT_SIZE),

        "--jinja",

        # Important for your current laptop.
        # Render can override this later with an
        # environment variable / deployment configuration.
        "--n-gpu-layers",
        os.getenv(
            "QWEN_GPU_LAYERS",
            "0",
        ),

        # Keep CPU usage reasonable on smaller machines.
        "--threads",
        os.getenv(
            "QWEN_THREADS",
            "4",
        ),
    ]

    return command


def start_llama_server() -> None:
    global llama_process
    global llama_ready

    if is_llama_ready():
        llama_ready = True

        print(
            "llama.cpp is already running."
        )

        return

    command = build_llama_command()

    print("=" * 70)
    print("Starting llama.cpp")
    print("=" * 70)
    print(
        "Model:",
        f"{QWEN_MODEL_REPO}:{QWEN_MODEL_QUANT}",
    )
    print(
        "Context:",
        QWEN_CONTEXT_SIZE,
    )
    print(
        "GPU layers:",
        os.getenv(
            "QWEN_GPU_LAYERS",
            "0",
        ),
    )
    print(
        "Threads:",
        os.getenv(
            "QWEN_THREADS",
            "4",
        ),
    )
    print("=" * 70)

    try:
        llama_process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

    except FileNotFoundError:
        raise RuntimeError(
            "llama-server was not found. "
            "Make sure llama.cpp is installed "
            "and llama-server is available in PATH."
        )

    def stream_logs():
        if llama_process is None:
            return

        if llama_process.stdout is None:
            return

        for line in llama_process.stdout:
            print(
                f"[llama.cpp] {line.rstrip()}"
            )

    threading.Thread(
        target=stream_logs,
        daemon=True,
    ).start()

    print(
        "Waiting for llama.cpp to become ready..."
    )

    # Model download + loading can take a while.
    for attempt in range(300):
        if is_llama_ready():
            llama_ready = True

            print("=" * 70)
            print(
                "llama.cpp is ready."
            )
            print(
                "URL:",
                get_llama_base_url(),
            )
            print("=" * 70)

            return

        # Detect an early process failure.
        if (
            llama_process.poll()
            is not None
        ):
            raise RuntimeError(
                "llama-server stopped before "
                "becoming ready."
            )

        if attempt % 10 == 0:
            print(
                f"Still waiting... "
                f"{attempt}s"
            )

        time.sleep(1)

    raise RuntimeError(
        "llama.cpp did not become ready "
        "within 300 seconds."
    )


def ensure_llama_server() -> None:
    global llama_ready

    if (
        llama_ready
        and is_llama_ready()
    ):
        return

    with llama_lock:
        if (
            llama_ready
            and is_llama_ready()
        ):
            return

        start_llama_server()


# ============================================================
# Startup
# ============================================================

@app.on_event("startup")
def startup_event():
    print("=" * 70)
    print("InterviewIQ Qwen Service")
    print("=" * 70)
    print(
        "Qwen model:",
        f"{QWEN_MODEL_REPO}:{QWEN_MODEL_QUANT}",
    )
    print(
        "FastAPI:",
        f"http://{APP_HOST}:{APP_PORT}",
    )
    print(
        "llama.cpp:",
        get_llama_base_url(),
    )
    print("=" * 70)

    ensure_llama_server()


# ============================================================
# Shutdown
# ============================================================

@app.on_event("shutdown")
def shutdown_event():
    global llama_process
    global llama_ready

    llama_ready = False

    if llama_process is None:
        return

    print(
        "Stopping llama.cpp..."
    )

    try:
        llama_process.terminate()

        llama_process.wait(
            timeout=10
        )

    except subprocess.TimeoutExpired:
        print(
            "llama.cpp did not stop gracefully. "
            "Killing process."
        )

        llama_process.kill()

    except Exception as error:
        print(
            "Error while stopping llama.cpp:",
            error,
        )

    finally:
        llama_process = None


# ============================================================
# Routes
# ============================================================

@app.get("/")
def root():
    return {
        "service": "InterviewIQ Qwen Server",
        "status": (
            "running"
            if llama_ready
            else "starting"
        ),
        "model": QWEN_MODEL_REPO,
        "quantization": QWEN_MODEL_QUANT,
        "llamaCpp": get_llama_base_url(),
    }


@app.get("/health")
def health():
    llama_status = is_llama_ready()

    return {
        "status": (
            "healthy"
            if llama_status
            else "starting"
        ),
        "model": QWEN_MODEL_REPO,
        "quantization": QWEN_MODEL_QUANT,
        "llamaCpp": llama_status,
    }


# ============================================================
# Generate
# ============================================================

@app.post(
    "/generate",
    response_model=GenerateResponse,
)
def generate(
    request: GenerateRequest,
):
    try:
        ensure_llama_server()

        messages = []

        if request.system:
            messages.append(
                {
                    "role": "system",
                    "content": request.system,
                }
            )

        messages.append(
            {
                "role": "user",
                "content": request.message,
            }
        )

        payload = {
            "messages": messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": False,
            "chat_template_kwargs": {
                "enable_thinking": False
            }
        }

        response = requests.post(
            get_llama_chat_url(),
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=300,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": (
                        "Qwen generation failed."
                    ),
                    "llamaStatusCode": (
                        response.status_code
                    ),
                    "llamaResponse": (
                        response.text
                    ),
                },
            )

        data = response.json()
        generated_text = extract_generated_text(data)

        if not generated_text:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Qwen returned an empty response."
                ),
            )

        return GenerateResponse(
            response=generated_text,
            model=(
                f"{QWEN_MODEL_REPO}:"
                f"{QWEN_MODEL_QUANT}"
            ),
            usage=data.get(
                "usage"
            ),
        )

    except HTTPException:
        raise

    except requests.Timeout:
        raise HTTPException(
            status_code=504,
            detail=(
                "Qwen generation timed out."
            ),
        )

    except requests.RequestException as error:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Could not communicate with "
                f"llama.cpp: {error}"
            ),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# ============================================================
# Local execution
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=APP_HOST,
        port=APP_PORT,
    )