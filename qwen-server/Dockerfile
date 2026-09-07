FROM python:3.11-slim

WORKDIR /app

# =========================================================
# SYSTEM DEPENDENCIES
# =========================================================

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    cmake \
    curl \
    ca-certificates \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*


# =========================================================
# BUILD LLAMA.CPP
# =========================================================

RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /tmp/llama.cpp \
    && cmake -S /tmp/llama.cpp -B /tmp/llama.cpp/build \
        -DCMAKE_BUILD_TYPE=Release \
        -DGGML_NATIVE=OFF \
        -DGGML_OPENMP=OFF \
        -DLLAMA_OPENSSL=ON \
    && cmake --build /tmp/llama.cpp/build \
        --target llama-server \
        --config Release \
        -j1 \
    && cp /tmp/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server \
    && find /tmp/llama.cpp/build -type f -name "*.so*" \
        -exec cp -P {} /usr/local/lib/ \; \
    && ldconfig \
    && chmod +x /usr/local/bin/llama-server \
    && llama-server --version \
    && rm -rf /tmp/llama.cpp


# =========================================================
# PYTHON DEPENDENCIES
# =========================================================

COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r /app/requirements.txt


# =========================================================
# APPLICATION
# =========================================================

COPY app.py /app/app.py


# =========================================================
# ENVIRONMENT
# =========================================================

ENV HOST=0.0.0.0

ENV LLAMA_HOST=127.0.0.1
ENV LLAMA_PORT=8080
ENV LLAMA_SERVER_PATH=/usr/local/bin/llama-server

# Qwen small model for Render Free
ENV QWEN_MODEL_REPO=Qwen/Qwen2.5-0.5B-Instruct-GGUF
ENV QWEN_MODEL_QUANT=Q4_K_M

# Keep RAM usage low
ENV QWEN_CONTEXT_SIZE=512
ENV QWEN_MAX_TOKENS=128
ENV QWEN_THREADS=1
ENV QWEN_GPU_LAYERS=0

# llama.cpp shared libraries
ENV LD_LIBRARY_PATH=/usr/local/lib


# =========================================================
# START FASTAPI
# =========================================================

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]