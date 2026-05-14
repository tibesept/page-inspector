# Built with context=REPO ROOT so Docker can see _shared/ workspace.
# Usage: docker build -f bot/Dockerfile .  (from repo root)

#-----------------------------------------
# STAGE 1: BUILDER
#-----------------------------------------
FROM node:22.20.0-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY _shared/package.json ./_shared/
COPY api/package.json ./api/
COPY bot/package.json ./bot/
COPY worker/package.json ./worker/

RUN npm ci

# Build _shared first
COPY tsconfig.base.json ./
COPY _shared/ ./_shared/
RUN npm run build -w _shared

# Build bot
COPY bot/tsconfig.json ./bot/
COPY bot/src ./bot/src
RUN npm run build -w bot

#-----------------------------------------
# STAGE 2: PRODUCTION
#-----------------------------------------
FROM node:22.20.0-slim AS production

WORKDIR /app

# Copy hoisted node_modules (includes @page-inspector/shared symlink)
COPY --from=builder /app/node_modules ./node_modules

# Copy shared package dist (symlink target)
COPY --from=builder /app/_shared/dist ./_shared/dist
COPY --from=builder /app/_shared/package.json ./_shared/

# Copy bot artifacts
COPY --from=builder /app/bot/dist ./bot/dist
COPY --from=builder /app/bot/package.json ./bot/

WORKDIR /app/bot

CMD ["node", "dist/index.js"]

#-----------------------------------------
# STAGE 3: DEVELOPMENT
#-----------------------------------------
FROM node:22.20.0-slim AS development

WORKDIR /app

COPY package.json package-lock.json ./
COPY _shared/package.json ./_shared/
COPY api/package.json ./api/
COPY bot/package.json ./bot/
COPY worker/package.json ./worker/

RUN npm install

COPY tsconfig.base.json ./
COPY _shared/ ./_shared/
RUN npm run build -w _shared

COPY bot/ ./bot/

WORKDIR /app/bot

CMD ["npm", "run", "dev"]