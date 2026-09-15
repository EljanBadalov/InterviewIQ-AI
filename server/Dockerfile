# =========================================================
# InterviewIQ API
# Node.js + ONNX Runtime + en_US.UTF-8 locale
# =========================================================

FROM node:20-bookworm-slim

WORKDIR /app

# ---------------------------------------------------------
# System dependencies
#
# locales:
#   Required by ONNX Runtime StringNormalizer.
#
# ca-certificates:
#   Required for HTTPS connections to external services.
# ---------------------------------------------------------

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

# ---------------------------------------------------------
# Install Node dependencies
# ---------------------------------------------------------

COPY package.json package-lock.json ./

RUN npm ci

# ---------------------------------------------------------
# Copy application
# ---------------------------------------------------------

COPY . .

# ---------------------------------------------------------
# Build TypeScript
# ---------------------------------------------------------

RUN npm run build

# ---------------------------------------------------------
# Render provides PORT dynamically.
# Your Node application should already read process.env.PORT.
# ---------------------------------------------------------

ENV NODE_ENV=production

EXPOSE 10000

CMD ["npm", "start"]