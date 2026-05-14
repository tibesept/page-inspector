#-----------------------------------------
# ЭТАП 1: BUILDER
# Собирает production-ready артефакты
#-----------------------------------------
FROM node:22.20.0-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

#-----------------------------------------
# ЭТАП 2: PRODUCTION
# Финальный, легковесный образ для прода
#-----------------------------------------
FROM node:22.20.0-slim AS production

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# порт для вебхука
# EXPOSE 8080

CMD ["node", "dist/index.js"]