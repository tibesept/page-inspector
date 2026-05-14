#-----------------------------------------
# ЭТАП 1: BASE
# Создает общую основу с системными зависимостями
#-----------------------------------------
FROM node:22.20.0-slim AS base


# Устанавливаем Google Chrome Stable вместо Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Утилиты, необходимые для добавления репозитория Chrome
    ca-certificates \
    curl \
    gnupg \
    # Шрифты для корректного отображения
    fonts-noto \
    fonts-noto-color-emoji \
    # dumb-init для корректной обработки сигналов
    dumb-init \
    # Добавляем ключ и репозиторий Google Chrome
    && curl -sSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    # Устанавливаем сам браузер
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    # Очищаем кэш
    && rm -rf /var/lib/apt/lists/*


# гооврим Puppeteer-core использовать нами установленный Chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome


# Создаем специального НЕ рутированного юзера для запуска приложения.
RUN groupadd -r nodeuser && useradd -r -g nodeuser -m -s /bin/bash nodeuser

WORKDIR /home/nodeuser/app



#-----------------------------------------
# ЭТАП 2: DEPS
# Зависимости
#-----------------------------------------
FROM base AS deps

COPY --chown=nodeuser:nodeuser package*.json ./
RUN npm ci


#-----------------------------------------
# ЭТАП 3: BUILDER
# Собирает production-ready артефакты
#-----------------------------------------
FROM deps AS builder

COPY --chown=nodeuser:nodeuser . .
RUN npm run build
RUN npm prune --production


#-----------------------------------------
# ЭТАП 4: PRODUCTION
# Финальный, легковесный образ для прода
#-----------------------------------------
FROM base AS final

WORKDIR /home/nodeuser/app
USER nodeuser

# Копируем только скомпилированный код и production-зависимости
COPY --chown=nodeuser:nodeuser --from=builder /home/nodeuser/app/dist ./dist
COPY --chown=nodeuser:nodeuser --from=builder /home/nodeuser/app/node_modules ./node_modules
COPY --chown=nodeuser:nodeuser --from=builder /home/nodeuser/app/package.json ./

# dumb-init будет корректно обрабатывать сигналы (например, SIGTERM от Docker)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD [ "node", "dist/index.js" ]


#-----------------------------------------
# ЭТАП 5: DEVELOPMENT
# Образ для разработки с hot-reload
#-----------------------------------------
FROM deps AS development

USER nodeuser
COPY --chown=nodeuser:nodeuser . .

CMD [ "npm", "run", "dev" ]