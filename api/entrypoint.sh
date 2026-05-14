#!/bin/sh

# Вывод команд на экран
set -e

# Ждем, пока бд будет готова 
npx wait-on tcp:postgres:5432

echo "Applying Prisma migrations..."
# Применяем миграции
npx prisma migrate deploy

echo "Starting the application..."
# Запускаем основное приложение
exec "$@"