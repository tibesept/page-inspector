# Page Inspector  🔍️

Это Telegram-бот для SEO-аналитики сайтов. Он построен на микросервисной архитектуре.

Веб-мастерам и SEO-специалистам часто требуется быстро проверить базовые технические параметры сайта: доступность robots.txt, наличие битых ссылок, скорость загрузки. Существующие инструменты либо платные, либо требуют открытия десктоп-приложений. Мой бот решает эту проблему, предоставляя ключевую аналитику по запросу прямо в Telegram, что экономит время и позволяет проводить мониторинг с любого устройства.

## Сами репозитории:
* [Telegram-бот](https://github.com/tibesept/page-inspector-bot)
* [REST API](https://github.com/tibesept/page-inspector-api)
* [Worker](https://github.com/tibesept/page-inspector-worker)

---

# PageInspector Architecture

PageInspector is built as a **Node.js/TypeScript Monorepo** using npm workspaces, orchestrated with Docker and RabbitMQ for high scalability.

## 🏗 Architecture & Workspaces

The repository is divided into four main npm workspaces:

- **`_shared`** (`@page-inspector/shared`): Contains shared DTOs, Zod schemas, and types. Used across all other services to prevent schema drift.
- **`api`** (`page-inspector-api`): An Express.js REST API that manages the PostgreSQL database via Prisma, orchestrates job creation, and serves as the RabbitMQ producer.
- **`worker`** (`page-inspector-worker`): A heavy-duty background worker (RabbitMQ consumer) running Puppeteer to analyze web pages, capture screenshots, and extract SEO/Lighthouse metrics.
- **`bot`** (`page-inspector-bot`): A Telegram bot built with grammY that provides the user interface, polling the API for job statuses and returning the final analysis and AI summaries.

### Tech Stack
- **Languages:** TypeScript, Node.js
- **Database / ORM:** PostgreSQL, Prisma
- **Message Broker:** RabbitMQ
- **Scraping / Analysis:** Puppeteer, Google Chrome, Lighthouse
- **Bot Framework:** grammY
- **Validation:** Zod
- **Infrastructure:** Docker, Docker Compose, GNU Make

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- Node.js 22+ (for local development/IDE support)

### Environment Variables
You need to configure `.env` files for the services. Copy the example files and fill in your secrets (OpenAI keys, Telegram Bot tokens, Database passwords):
- `api/.env` (Also used by Docker Compose for infra variables)
- `bot/.env`
- `worker/.env`

---

## 🛠 Local Development

The project uses a unified root Makefile and Docker Compose setup. For local development with **hot-reloading** (mounting your local `./src` directories into the containers):

```bash
# Build and start all services in development mode
make up ENV=dev
```

This will automatically spin up PostgreSQL, RabbitMQ, Adminer, API, Bot, and the Worker. Changes to TypeScript files in any workspace will trigger nodemon/tsx reloads.

### Local TypeScript Compilation
If you want to compile the project locally without Docker:
```bash
npm install
make ts
```

---

## 🌍 Production Deployment

In production, the application is designed to be highly scalable. You can run all services on a single server, or split them across multiple Virtual Private Servers (VPS).

### Option 1: Single Server Deploy
To deploy everything on a single machine with production limits (e.g., 10 worker replicas):
```bash
make up ENV=prod
```

### Option 2: Multi-Server (VPS) Split Deploy
Docker Compose is configured to only spin up the requested service and its direct dependencies. 

**Server 1 (API & Databases)**
```bash
make up ENV=prod srv=api
```
*(Starts `postgres`, `rabbitmq`, and `api`)*

**Server 2 (Telegram Bot)**
Configure `bot/.env` to point `API_HOST` to Server 1's IP.
```bash
make up ENV=prod srv=bot
```
*(Starts ONLY the bot)*

**Server 3 (High-CPU Worker Pool)**
Configure `worker/.env` to point to Server 1's RabbitMQ and API.
```bash
make up ENV=prod srv=worker
```
*(Starts ONLY the workers. In `ENV=prod`, this automatically spins up 10 replicas with CPU/RAM limits).*

---

## 📜 Available Commands

The root `Makefile` provides the following utilities:

| Command | Description |
|---------|-------------|
| `make up` | Start all services (default `ENV=prod`) |
| `make up ENV=dev` | Start all services in development mode (hot-reloading) |
| `make up srv=<name>`| Start a specific service (e.g., `srv=api`) |
| `make down` | Stop & remove all containers, networks, and volumes |
| `make stop` | Stop containers without removing them |
| `make build` | Rebuild Docker images without starting containers |
| `make logs srv=<name>`| Tail logs for a specific service |
| `make shell srv=<name>`| Open a shell (`sh`) inside a running container |
| `make clean` | Nuke everything: containers, images, orphans, and volumes |
