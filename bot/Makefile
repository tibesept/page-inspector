# --- Конфигурация ---

# файлы
COMPOSE_BASE_FILE := docker-compose.yml
COMPOSE_OVERRIDE_FILE := docker-compose.override.yml
COMPOSE_PROD_FILE := docker-compose.prod.yml
COMPOSE_ARM_FILE := docker-compose.arm64.yml

# по умолчанию 'dev'.
ENV ?= dev

# список файлов docker-compose
COMPOSE_FILES := -f $(COMPOSE_BASE_FILE)

ifeq ($(ENV), dev)
    COMPOSE_FILES += -f $(COMPOSE_OVERRIDE_FILE)
endif
ifeq ($(ENV), prod)
    COMPOSE_FILES += -f $(COMPOSE_PROD_FILE)
endif

# флаг для ARM-архитектуры, если нужно
ifneq ($(shell uname -m), x86_64)
    ifneq ($(wildcard $(COMPOSE_ARM_FILE)),)
        COMPOSE_FILES += -f $(COMPOSE_ARM_FILE)
    endif
endif

# --- Команды ---

.DEFAULT_GOAL := help

# Группа: Управление окружением
# --------------------------------------------------
up: ## Запустить окружение (dev по умолчанию, либо ENV=prod)
	docker compose $(COMPOSE_FILES) up --build -d

down: ## Остановить и удалить контейнеры, сети и тома для текущего окружения
	docker compose $(COMPOSE_FILES) down -v

stop: ## Остановить контейнеры, не удаляя их
	docker compose $(COMPOSE_FILES) stop

restart: ## Перезапустить все сервисы
	docker compose $(COMPOSE_FILES) restart

# Группа: Мониторинг и отладка
# --------------------------------------------------
logs: ## Показать логи всех сервисов в реальном времени
	docker compose $(COMPOSE_FILES) logs -f --tail=100

ps: ## Показать статус контейнеров
	docker compose $(COMPOSE_FILES) ps

shell: ## Зайти в shell сервиса (например, make shell srv=bot)
	docker compose $(COMPOSE_FILES) exec $(srv) sh

# Группа: Сборка и очистка
# --------------------------------------------------
build: ## Принудительно пересобрать образы без запуска контейнеров
	docker compose $(COMPOSE_FILES) build

clean: down ## Полная очистка: остановить, удалить контейнеры, сети и образы
	docker compose $(COMPOSE_FILES) down --rmi all --remove-orphans

# Группа: Справка
# --------------------------------------------------
help: ## Показать эту справку
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Объявляем цели, которые не являются файлами
.PHONY: up down stop restart logs ps shell build clean help