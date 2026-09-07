FROM python:3.11-slim

WORKDIR /app

# ---------------------------------------------------------
# System dependencies
# ---------------------------------------------------------
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    cmake \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------
# Build llama.cpp
# ---------------------------------------------------------
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /tmp/llama.cpp \
    && cmake -S /tmp/llama.cpp -B /tmp/llama.cpp/build \
        -DCMAKE_BUILD_TYPE=Release \
        -DGGML_NATIVE=OFF \
        -DGGML_OPENMP=OFF \
    && cmake --build /tmp/llama.cpp/build \
        --target llama-server \
        --config Release \
        -j1 \
    && cp /tmp/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server \
    && find /tmp/llama.cpp/build -type f -name "*.so*" -exec cp -P {} /usr/local/lib/ \; \
    && ldconfig \
    && chmod +x /usr/local/bin/llama-server \
    && llama-server --version \
    && rm -rf /tmp/llama.cpp

# ---------------------------------------------------------
# Python dependencies
# ---------------------------------------------------------
COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r /app/requirements.txt

# ---------------------------------------------------------
# Application
# ---------------------------------------------------------
COPY app.py /app/app.py

# ---------------------------------------------------------
# Environment
# ---------------------------------------------------------
ENV HOST=0.0.0.0

# Render özü PORT verir.
# Local fallback app.py daxilində 8000-dir.

ENV LLAMA_HOST=127.0.0.1
ENV LLAMA_PORT=8080
ENV LLAMA_SERVER_PATH=/usr/local/bin/llama-server

# Small model for Render Free testing
ENV QWEN_MODEL_REPO=Qwen/Qwen2.5-0.5B-Instruct-GGUF
ENV QWEN_MODEL_QUANT=Q4_K_M

# Keep memory usage as low as possible
ENV QWEN_CONTEXT_SIZE=512
ENV QWEN_MAX_TOKENS=128
ENV QWEN_THREADS=1
ENV QWEN_GPU_LAYERS=0

# Make shared llama.cpp libraries discoverable
ENV LD_LIBRARY_PATH=/usr/local/lib

# ---------------------------------------------------------
# Start FastAPI
# ---------------------------------------------------------
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]