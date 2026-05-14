# Built with context=REPO ROOT so Docker can see _shared/ workspace.
# Usage: docker build -f worker/Dockerfile .  (from repo root)

#-----------------------------------------
# STAGE 1: BASE — System dependencies + Chrome
#-----------------------------------------
FROM node:22.20.0-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    fonts-noto \
    fonts-noto-color-emoji \
    dumb-init \
    chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN groupadd -r nodeuser && useradd -r -g nodeuser -m -s /bin/bash nodeuser

#-----------------------------------------
# STAGE 2: DEPS — Install node_modules
#-----------------------------------------
FROM base AS deps

WORKDIR /app

COPY --chown=nodeuser:nodeuser package.json package-lock.json ./
COPY --chown=nodeuser:nodeuser _shared/package.json ./_shared/
COPY --chown=nodeuser:nodeuser api/package.json ./api/
COPY --chown=nodeuser:nodeuser bot/package.json ./bot/
COPY --chown=nodeuser:nodeuser worker/package.json ./worker/

RUN npm ci

#-----------------------------------------
# STAGE 3: BUILDER — Compile TypeScript
#-----------------------------------------
FROM deps AS builder

# Build _shared first
COPY --chown=nodeuser:nodeuser tsconfig.base.json ./
COPY --chown=nodeuser:nodeuser _shared/ ./_shared/
RUN npm run build -w _shared

# Build worker
COPY --chown=nodeuser:nodeuser worker/tsconfig.json ./worker/
COPY --chown=nodeuser:nodeuser worker/src ./worker/src
RUN npm run build -w worker
RUN npm prune --production

#-----------------------------------------
# STAGE 4: PRODUCTION
#-----------------------------------------
FROM base AS final

WORKDIR /app
USER nodeuser

# Copy hoisted node_modules (includes @page-inspector/shared symlink)
COPY --chown=nodeuser:nodeuser --from=builder /app/node_modules ./node_modules

# Copy shared package dist (symlink target)
COPY --chown=nodeuser:nodeuser --from=builder /app/_shared/dist ./_shared/dist
COPY --chown=nodeuser:nodeuser --from=builder /app/_shared/package.json ./_shared/

# Copy worker artifacts
COPY --chown=nodeuser:nodeuser --from=builder /app/worker/dist ./worker/dist
COPY --chown=nodeuser:nodeuser --from=builder /app/worker/package.json ./worker/

WORKDIR /app/worker

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]

#-----------------------------------------
# STAGE 5: DEVELOPMENT
#-----------------------------------------
FROM deps AS development

USER nodeuser

COPY --chown=nodeuser:nodeuser tsconfig.base.json ./
COPY --chown=nodeuser:nodeuser _shared/ ./_shared/
RUN npm run build -w _shared

COPY --chown=nodeuser:nodeuser worker/ ./worker/

WORKDIR /app/worker

CMD ["npm", "run", "dev"]