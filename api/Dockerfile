# Built with context=REPO ROOT so Docker can see _shared/ workspace.
# Usage: docker build -f api/Dockerfile .  (from repo root)

#-----------------------------------------
# STAGE 1: BUILDER
#-----------------------------------------
FROM node:22.20.0-slim AS builder

RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Copy ALL workspace package.jsons + root lockfile for layer caching.
#    npm ci validates the lockfile against every workspace — all must be present.
COPY package.json package-lock.json ./
COPY _shared/package.json ./_shared/
COPY api/package.json ./api/
COPY bot/package.json ./bot/
COPY worker/package.json ./worker/

RUN npm ci

# 2. Build _shared first (consumers depend on its dist/)
COPY tsconfig.base.json ./
COPY _shared/ ./_shared/
RUN npm run build -w _shared

# 3. Build API
COPY api/tsconfig.json ./api/
COPY api/prisma ./api/prisma
RUN cd api && npx prisma generate

COPY api/src ./api/src
RUN npm run build -w api

#-----------------------------------------
# STAGE 2: PRODUCTION
#-----------------------------------------
FROM node:22.20.0-slim AS production

RUN apt-get update && apt-get install -y libssl3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy hoisted node_modules (includes @page-inspector/shared symlink)
COPY --from=builder /app/node_modules ./node_modules

# Copy shared package dist (symlink target)
COPY --from=builder /app/_shared/dist ./_shared/dist
COPY --from=builder /app/_shared/package.json ./_shared/

# Copy API artifacts
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/api/package.json ./api/
COPY --from=builder /app/api/node_modules/.prisma ./api/node_modules/.prisma
COPY --from=builder /app/api/prisma ./api/prisma
COPY api/entrypoint.sh ./api/entrypoint.sh
RUN chmod +x ./api/entrypoint.sh

WORKDIR /app/api

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/index.js"]

#-----------------------------------------
# STAGE 3: DEVELOPMENT
#-----------------------------------------
FROM node:22.20.0-slim AS development

RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

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

COPY api/ ./api/
RUN cd api && npx prisma generate
RUN chmod +x ./api/entrypoint.sh

WORKDIR /app/api

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "dev"]