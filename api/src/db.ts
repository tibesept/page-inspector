import { PrismaClient } from '@prisma/client';

// Создаем единственный экземпляр клиента
export const prisma = new PrismaClient();