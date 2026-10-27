import os
import subprocess
import threading
import time
from typing import Optional, Dict, Any

import requests
import anyio
from generation_boundary import GenerationBudget, GenerationExpired, normalize_finish_reason
from fastapi import FastAPI, HTTPException, Request
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


    # Optional transport metadata; sampling and model settings are unchanged.
    request_budget_ms: Optional[int] = Field(default=None, ge=1, le=300000)
    deadline_unix_ms: Optional[int] = Field(default=None, ge=1)
    correlation_id: Optional[str] = Field(default=None, pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class GenerateResponse(BaseModel):
    response: str
    model: str
    usage: Optional[dict] = None
    finish_reason: Optional[str] = None
    timings_ms: Optional[Dict[str, float]] = None
    diagnostics: Optional[Dict[str, Any]] = None


# ============================================================
# Global state
# ============================================================

llama_process: Optional[subprocess.Popen] = None
llama_ready = False
llama_lock = threading.Lock()
generation_lock = threading.Lock()

# ============================================================
# URLs
# ============================================================


def get_llama_base_url() -> str:
    return f"http://{LLAMA_HOST}:{LLAMA_PORT}"


def get_llama_health_url() -> str:
    return f"{get_llama_base_url()}/health"


def get_llama_chat_url() -> str:
    return f"{get_llama_base_url()}/v1/chat/completions"


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

        # =====================================================
        # CONTEXT
        # =====================================================
        "--ctx-size",
        str(QWEN_CONTEXT_SIZE),

        # =====================================================
        # PARALLEL / SLOTS
        #
        # Render CPU instance-də yalnız bir generation slot
        # istifadə edirik. Default 4 slot CPU resursunu
        # lazımsız yerə bölürdü.
        # =====================================================
        "--parallel",
        os.getenv(
            "QWEN_PARALLEL",
            "1",
        ),

        # =====================================================
        # CHAT TEMPLATE
        # =====================================================
        "--jinja",

        # =====================================================
        # GPU
        #
        # Render deployment hazırda CPU-only işləyir.
        # Daha sonra GPU server istifadə etsək ENV vasitəsilə
        # dəyişdirə bilərik.
        # =====================================================
        "--n-gpu-layers",
        os.getenv(
            "QWEN_GPU_LAYERS",
            "0",
        ),

        # =====================================================
        # CPU THREADS
        # =====================================================
        "--threads",
        os.getenv(
            "QWEN_THREADS",
            "2",
        ),

        # Prompt/batch processing üçün thread sayı.
        "--threads-batch",
        os.getenv(
            "QWEN_THREADS_BATCH",
            "2",
        ),

        # =====================================================
        # BATCH SETTINGS
        #
        # Aşağı resurslu Render instance üçün daha konservativ
        # batch ölçüləri.
        # =====================================================
        "--batch-size",
        os.getenv(
            "QWEN_BATCH_SIZE",
            "128",
        ),

        "--ubatch-size",
        os.getenv(
            "QWEN_UBATCH_SIZE",
            "64",
        ),
    ]

    return command

def start_llama_server() -> None:
    global llama_process
    global llama_ready

    if is_llama_ready():
        llama_ready = True

        print("llama.cpp is already running.")

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
            print(f"[llama.cpp] {line.rstrip()}")

    threading.Thread(
        target=stream_logs,
        daemon=True,
    ).start()

    print("Waiting for llama.cpp to become ready...")

    # Model download + loading can take a while.
    for attempt in range(300):
        if is_llama_ready():
            llama_ready = True

            print("=" * 70)
            print("llama.cpp is ready.")
            print(
                "URL:",
                get_llama_base_url(),
            )
            print("=" * 70)

            return

        # Detect an early process failure.
        if llama_process.poll() is not None:
            raise RuntimeError("llama-server stopped before " "becoming ready.")

        if attempt % 10 == 0:
            print(f"Still waiting... " f"{attempt}s")

        time.sleep(1)

    raise RuntimeError("llama.cpp did not become ready " "within 300 seconds.")


def ensure_llama_server() -> None:
    global llama_ready
    if not is_llama_ready():
        raise RuntimeError("An already-ready approved model is required; automatic startup is disabled")
    llama_ready = True


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

    print("Stopping llama.cpp...")

    try:
        llama_process.terminate()

        llama_process.wait(timeout=10)

    except subprocess.TimeoutExpired:
        print("llama.cpp did not stop gracefully. " "Killing process.")

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
        "status": ("running" if llama_ready else "starting"),
        "model": QWEN_MODEL_REPO,
        "quantization": QWEN_MODEL_QUANT,
        "llamaCpp": get_llama_base_url(),
    }


@app.get("/health")
def health():
    llama_status = is_llama_ready()

    return {
        "status": ("healthy" if llama_status else "starting"),
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
def generate(request: GenerateRequest, http_request: Request = None):
    def disconnected():
        # FastAPI executes this synchronous route in an AnyIO worker thread.
        return anyio.from_thread.run(http_request.is_disconnected) if http_request is not None else False

    budget = GenerationBudget(request.request_budget_ms, request.deadline_unix_ms, disconnected)
    stage = "queue"
    inference_dispatched = False

    def failure(status, code, message):
        # Fixed vocabulary only: no upstream exceptions, prompts, answers or response bodies.
        detail = {"code": code, "stage": stage, "inferenceDispatched": inference_dispatched}
        print("[QWEN] Generation failure", {"correlationId": request.correlation_id, **detail}, flush=True)
        return HTTPException(status_code=status, detail={**detail, "message": message})

    try:
        with budget.slot(generation_lock):
            stage = "readiness"
            readiness_started = time.monotonic()
            budget.check()
            ensure_llama_server()
            readiness_ms = (time.monotonic() - readiness_started) * 1000
            budget.check()
            messages = []
            if request.system:
                messages.append({"role": "system", "content": request.system})
            messages.append({"role": "user", "content": request.message})
            payload = {
                "messages": messages,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
                "top_p": request.top_p,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": False},
            }
            budget.check()
            started_at = time.monotonic()
            request_timeout = min(300, budget.remaining())
            stage = "inference"
            inference_dispatched = True
            response = requests.post(
                get_llama_chat_url(), json=payload,
                headers={"Content-Type": "application/json"},
                timeout=request_timeout,
            )
            inference_ms = (time.monotonic() - started_at) * 1000
            stage = "response"
        # A completed network roundtrip does not prove remote cancellation on timeout.
        timings = {"queue_wait": budget.queue_wait_ms, "readiness": readiness_ms, "inference_roundtrip": inference_ms}
        print("[QWEN] Generation timings", {"correlationId": request.correlation_id, **timings})
        if response.status_code != 200:
            raise failure(502, "QWEN_PROXY_FAILED", "llama.cpp generation failed")
        try:
            data = response.json()
        except ValueError:
            raise failure(502, "QWEN_RESPONSE_INVALID_JSON", "llama.cpp returned invalid JSON")
        if not isinstance(data, dict):
            raise failure(502, "QWEN_RESPONSE_INVALID_JSON", "llama.cpp returned an invalid response object")
        generated_text = extract_generated_text(data)
        if not generated_text:
            raise failure(502, "QWEN_RESPONSE_EMPTY", "Qwen returned an empty response")
        choices = data.get("choices", [])
        first = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
        return GenerateResponse(
            response=generated_text, model=f"{QWEN_MODEL_REPO}:{QWEN_MODEL_QUANT}",
            usage=data.get("usage"), finish_reason=normalize_finish_reason(first.get("finish_reason")), timings_ms=timings,
            diagnostics={"stage": "completed", "inferenceDispatched": True},
        )
    except GenerationExpired:
        print("[QWEN] Expired or disconnected request discarded before dispatch")
        error = failure(504, "GENERATION_EXPIRED", "Generation deadline expired")
        error.detail["timings_ms"] = {"queue_wait": budget.queue_wait_ms or (time.monotonic() - budget.started) * 1000}
        raise error
    except HTTPException:
        raise
    except requests.Timeout:
        raise failure(504, "QWEN_TIMEOUT", "Qwen generation timed out")
    except requests.RequestException:
        raise failure(502, "QWEN_TRANSPORT_FAILED", "Could not communicate with llama.cpp")
    except Exception:
        # Never log prompts, generated text, URLs, or arbitrary upstream exception messages.
        if stage == "readiness" and not inference_dispatched:
            raise failure(503, "QWEN_MODEL_UNAVAILABLE", "The approved model is not ready")
        raise failure(500, "QWEN_PROXY_FAILED", "Qwen generation failed")


# ============================================================
# Local execution
# ============================================================

if __name__ == "__main__":
    from run_proxy import main
    main()
