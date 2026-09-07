FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    cmake \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Build llama.cpp
RUN git clone --depth 1 https://github.com/ggerganov/llama.cpp.git /tmp/llama.cpp \
    && cmake -S /tmp/llama.cpp -B /tmp/llama.cpp/build \
        -DGGML_NATIVE=OFF \
        -DGGML_OPENMP=OFF \
    && cmake --build /tmp/llama.cpp/build --config Release -j2 \
    && cp /tmp/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server \
    && rm -rf /tmp/llama.cpp

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV HOST=0.0.0.0
ENV PORT=8000

# Render Free test üçün daha kiçik model
ENV QWEN_MODEL_REPO=Qwen/Qwen2.5-0.5B-Instruct-GGUF
ENV QWEN_MODEL_QUANT=Q4_K_M
ENV QWEN_CONTEXT_SIZE=1024
ENV QWEN_MAX_TOKENS=256
ENV QWEN_THREADS=1
ENV QWEN_GPU_LAYERS=0

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]