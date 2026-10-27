# AST-only historical compatibility fixture; never execute or import.

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
