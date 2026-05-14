#-----------------------------------------
# ЭТАП 1: BUILDER
# Собирает production-ready артефакты
#-----------------------------------------
FROM node:22.20.0-slim AS builder

# Prisma для генерации своего движка требует системные библиотеки OpenSSL.
# Без libssl-dev команда 'prisma generate' не работает
# git добавляем на всякий случай, т.к. некоторые npm-пакеты могут подтягиваться напрямую из git-репозиториев.
RUN apt-get update && apt-get install -y openssl libssl-dev git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# зависимости
COPY package.json package-lock.json ./
RUN npm ci

# prisma
COPY prisma ./prisma
RUN npx prisma generate

# Копируем весь остальной код, включая entrypoint.sh
COPY . .
RUN npm run build

#-----------------------------------------
# ЭТАП 2: PRODUCTION
# Финальный, легковесный образ для прода
#-----------------------------------------
FROM node:22.20.0-slim AS production

# Скомпилированный на первом этапе движок Prisma для своей работы требует наличия
# системной библиотеки libssl.so.3.
# В отличие от первого этапа, здесь нам нужна только сама библиотека libssl3,
# а не полный пакет для разработки (libssl-dev), поэтому она весит меньше.
# Без этой команды приложение упадет с ошибкой "cannot open shared object file"
RUN apt-get update && apt-get install -y libssl3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем только необходимые для запуска артефакты из билдера
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]

# для production
CMD ["npm", "run", "start"]

#-----------------------------------------
# ЭТАП 3: DEVELOPMENT
# Образ для разработки с hot-reload
#-----------------------------------------
FROM node:22.20.0-slim AS development

# В режиме разработки нам также нужны dev-библиотеки для Prisma,
# если мы захотим перегенерировать клиент внутри контейнера.
RUN apt-get update && apt-get install -y openssl libssl-dev git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["npm", "run", "dev"]