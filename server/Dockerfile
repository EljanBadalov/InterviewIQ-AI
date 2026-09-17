# =========================================================
# InterviewIQ API
# Node.js + ONNX Runtime + Playwright + en_US.UTF-8
# =========================================================

FROM node:20-bookworm-slim

WORKDIR /app

# ONNX Runtime StringNormalizer requires a real en_US.UTF-8
# locale installed in the operating system.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        locales \
        ca-certificates \
    && sed -i 's/^# *\(en_US.UTF-8 UTF-8\)/\1/' /etc/locale.gen \
    && locale-gen \
    && update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Install Node dependencies, including TypeScript build dependencies.
COPY package.json package-lock.json ./

RUN npm ci --include=dev

# Install Chromium + required Linux dependencies.
RUN npx playwright install --with-deps chromium

# Copy backend source.
COPY . .

# Compile TypeScript.
RUN npm run build

ENV NODE_ENV=production

# Render supplies PORT dynamically.
EXPOSE 10000

CMD ["npm", "start"]