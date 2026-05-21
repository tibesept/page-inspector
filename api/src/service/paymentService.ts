import { prisma } from "../db";
import { BadRequestError } from "../errors/badRequest";

export class PaymentService {
    static async createPaymentIntent(userId: number, amountCredits: number, amountStars: number) {
        const bigIntUserId = BigInt(userId);
        
        // Гарантируем, что пользователь существует
        await prisma.user.upsert({
            where: { userId: bigIntUserId },
            update: {},
            create: { userId: bigIntUserId }
        });

        return await prisma.payment.create({
            data: {
                userId: bigIntUserId,
                amountCredits: amountCredits,
                amountStars: amountStars,
                status: "WAITING"
            }
        });
    }

    static async confirmPayment(paymentId: string, telegramChargeId: string) {
        return await prisma.$transaction(async (tx) => {
            // Атомарное обновление с проверкой статуса во избежание race conditions
            const result = await tx.payment.updateMany({
                where: {
                    id: paymentId,
                    status: "WAITING"
                },
                data: {
                    status: "DONE",
                    telegramChargeId: telegramChargeId
                }
            });

            if (result.count === 0) {
                // Если запись не обновлена, она либо не существует, либо уже обработана
                const payment = await tx.payment.findUnique({
                    where: { id: paymentId }
                });

                if (!payment) {
                    throw new BadRequestError("Payment intent not found");
                }

                if (payment.status === "DONE") {
                    return { alreadyProcessed: true, payment };
                }

                throw new BadRequestError(`Invalid payment status: ${payment.status}`);
            }

            // Запрашиваем обновленный платеж для подтверждения деталей
            const payment = await tx.payment.findUnique({
                where: { id: paymentId }
            });

            if (!payment) {
                throw new Error("Failed to retrieve updated payment");
            }

            // Начисляем баланс пользователю
            await tx.user.update({
                where: { userId: payment.userId },
                data: {
                    balance: {
                        increment: payment.amountCredits
                    }
                }
            });

            return { alreadyProcessed: false, payment };
        });
    }
}
