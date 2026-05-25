# ============================================================
# PageInspector Monorepo — Root Makefile
# ============================================================
# Usage:
#   make up                  — build & start all services (prod)
#   make up ENV=dev          — build & start in dev mode
#   make up srv=api          — build & start only the API
#   make logs srv=worker     — tail logs for one service
#   make shell srv=api       — exec into a running container
#   make build               — rebuild images without starting
#   make down                — stop & remove containers + volumes
#   make clean               — full nuke (images, orphans, volumes)
#   make ts                  — compile all TypeScript locally
# ============================================================

# --- Config ---
# Support lowercase 'env=dev' argument
ifdef env
  ENV := $(env)
endif
ENV ?= prod

COMPOSE_FILES := -f docker-compose.yml

ifeq ($(ENV),dev)
    COMPOSE_FILES += -f docker-compose.override.yml
else ifeq ($(ENV),prod)
    COMPOSE_FILES += -f docker-compose.prod.yml
endif

# Optionally load env vars for compose interpolation
# (ports, credentials). Point to wherever your infra vars live.
ENV_FILE ?= api/.env
ifneq ($(wildcard $(ENV_FILE)),)
    COMPOSE_FLAGS := --env-file $(ENV_FILE)
endif

# --- Docker Compose ---

.DEFAULT_GOAL := help

up: ## Start services (ENV=dev|prod, srv=<name> to target one)
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) up --build -d $(srv)

down: ## Stop & remove containers and networks (persists volumes)
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) down

stop: ## Stop containers without removing them
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) stop $(srv)

restart: ## Restart all (or srv=<name>)
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) restart $(srv)

build: ## Rebuild images without starting containers
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) build $(srv)

logs: ## Tail logs (srv=<name> for one service)
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) logs -f --tail=100 $(srv)

ps: ## Show container status
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) ps

shell: ## Open a shell in a running service (srv=api|bot|worker)
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) exec $(srv) sh

clean: down ## Full cleanup: remove containers, images, orphans
	docker compose $(COMPOSE_FLAGS) $(COMPOSE_FILES) down --rmi all --remove-orphans -v

# --- Local TypeScript ---

ts: ## Compile all TypeScript locally (no Docker)
	npm run build

ts-shared: ## Compile only _shared
	npm run build:shared

ts-api: ## Compile _shared + api
	npm run build:api

ts-bot: ## Compile _shared + bot
	npm run build:bot

ts-worker: ## Compile _shared + worker
	npm run build:worker

# --- Help ---

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.PHONY: up down stop restart build logs ps shell clean ts ts-shared ts-api ts-bot ts-worker help
