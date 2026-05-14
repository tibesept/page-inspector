import { prisma } from "../db";


export class UserService {
    static async getUserAndCreateIfNotExists(id: number) {
        return await prisma.user.upsert({
            where: { userId: id },
            update: {}, // Если пользователь существует, ничего не обновляем
            create: { userId: id }, // Если пользователя нет, создаём нового с этим userId
        });
    }

    // списание средств
    static async decrementBalance(id: number, amount: number) {
        return await prisma.user.update({
            where: { userId: id },
            data: {
                balance: {
                    decrement: amount
                }
            }
        });
    }

    static async getReadyJobs() {
        return await prisma.job.findMany({
            select: {
                jobId: true,
                userId: true,
                status: true,
            },
        });
    }
    static async getJobById(id: number) {
        return await prisma.job.findUnique({
            where: { jobId: id },
        });
    }
}