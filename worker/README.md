# 🚀 Page Analyzer Worker

Воркер на Node.JS и Puppeteer. Получает сообщения от RabbitMQ, выполняет джобы и отдает результат API.
Занимается самой тяжелой нагрузкой и поддерживает горизонтальное масштабирование (docker swarm).

## 📋 Содержание

- [🛠️ Стек](#stack)
- [⚙️ Требования](#requirements)
- [🚀 Быстрый старт](#quick-start)
- [▶️ Запуск и остановка](#run)
    - [Makefile](#makefile)
    - [Docker](#docker)
- [📄 Лицензия](#license)

<a id="stack"></a>
## 🛠️ Стек

  Node.js (v22.2.0), TypeScript  
* **Работа с браузером:** Puppeteer
* **Прослушивание очереди RabbitMQ:** amqplib  
* **Контейнеризация:** Docker, Docker Compose, Docker Swarm

<a id="requirements"></a>
## ⚙️ Требования

Для запуска проекта должны быть установлены:

* [Git](https://git-scm.com/)  
* [Docker](https://www.docker.com/) (версия 20.10+)  
* [Docker Compose](https://docs.docker.com/compose/) (версия 2.10+)

* _Опционально_: make (для удобства, совсем не обязательно)

✅ **Проверено на:** Docker Engine 27.0.3

💡 **Примечание:** Установка Node.js на локальную машину не требуется, так как проект полностью работает внутри Docker-контейнеров.


<a id="quick-start"></a>
## 🚀 Быстрый старт

1. **Склонируйте репозиторий** 

2. **Создайте и настройте `.env`**  
   Скопируйте файл `.env-example`
   ```bash
   cp .env-example .env
   ```
   Настройте значения

3. **Инициализируйте Docker Swarm (единоразово)**
	```bash
	docker swarm init
	```
	_Если Swarm уже инициализирован, вы увидите соответствующее сообщение - это нормально_

<a id="run"></a>
## ▶️ Запуск и остановка
<a id="makefile"></a>
### Makefile (рекомендуется)
```bash
make help # Показать все доступные команды
```
```bash
# --- Управление DEV-окружением (по умолчанию) ---
make up       # Запустить DEV-окружение
make down     # Остановить и удалить всё (контейнеры, тома, сети)
make logs     # Посмотреть логи
make ps       # Посмотреть статус контейнеров
make restart  # Перезапустить сервисы
make build    # Пересобрать образы
make clean    # Полная очистка, включая Docker-образы
```
```bash
# --- Управление PROD-окружением ---
make up ENV=prod       # Запустить PROD-окружение
make down ENV=prod     # Остановить и удалить всё для PROD
make logs ENV=prod     # Посмотреть логи PROD
make ps ENV=prod       # Посмотреть статус контейнеров PROD
```
```bash
# --- Дополнительные команды ---
make shell srv=service_name # Зайти в shell сервиса, например srv=worker-1
```


----
<a id="docker-run"></a>
### Docker

**1. Запуск окружения** 
* **DEV-окружение:** `docker compose` автоматически подхватит файлы `docker-compose.yml` и `docker-compose.override.yml`.
	```bash
	docker compose up --build -d
	```

* **PROD-окружение:** Здесь нужно явно указать, что мы используем конфигурацию для прода
	```bash
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
	```


**🖥️ ARM64:** пользователям Apple Silicon и любых других устройств на архитектуре **ARM64** необходимо вручную добавлять файл `docker-compose.arm64.yml` к командам

Пример DEV на ARM64:
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.arm64.yml up --build -d
```

**2. Остановка окружения**
 
 Для корректной остановки и удаления всех ресурсов (контейнеры, сети, тома) важно использовать те же -f флаги, что и при запуске.

* **Остановить DEV:**
    ```bash
	docker compose down -v 
	```

* **Остановить PROD:**
	```bash
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
	```

* **Остановить DEV на ARM64:**
	```bash 
	docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.arm64.yml down -v
	```

<a id="license"></a>
## **📄 Лицензия**

Все права на данный проект защищены. Использование и распространение в коммерческих или личных целях без предварительного письменного разрешения автора запрещено.