import { prisma } from "../db";
import { SERVICES_CATALOG, ProductId, PRODUCT_DEPENDENCIES } from "../types";
import { BadRequestError } from "../errors/badRequest";
import { Prisma } from "@prisma/client";
import logger from "../logger";
import { rabbitMQClient } from "../rabbit";

export class CartService {
    /**
     * Получает элементы корзины и общую стоимость для пользователя
     */
    static async getCart(userId: bigint) {
        const bigIntUserId = BigInt(userId);
        
        const cartItems = await prisma.cartItem.findMany({
            where: { userId: bigIntUserId },
            orderBy: { createdAt: "asc" }
        });

        const items = cartItems.map(item => {
            const product = SERVICES_CATALOG[item.productId as ProductId];
            return {
                productId: item.productId as ProductId,
                name: product ? product.name : item.productId,
                price: product ? product.priceCredits.toFixed(2) : "0.00"
            };
        });

        // Точный расчет стоимости с использованием Prisma.Decimal
        let totalDecimal = new Prisma.Decimal(0);
        for (const item of cartItems) {
            const product = SERVICES_CATALOG[item.productId as ProductId];
            if (product) {
                totalDecimal = totalDecimal.add(new Prisma.Decimal(product.priceCredits));
            }
        }

        return {
            items,
            totalCost: totalDecimal.toFixed(2)
        };
    }

    /**
     * Добавляет товар в корзину пользователя (идемпотентно)
     */
    static async addToCart(userId: bigint, productId: ProductId): Promise<any> {
        const bigIntUserId = BigInt(userId);

        // Гарантируем, что пользователь существует
        await prisma.user.upsert({
            where: { userId: bigIntUserId },
            update: {},
            create: { userId: bigIntUserId }
        });

        const product = SERVICES_CATALOG[productId];
        if (!product) {
            throw new BadRequestError(`Неизвестный продукт: ${productId}`);
        }

        // Автоматически добавляем родительский продукт, если есть зависимость
        const parentId = PRODUCT_DEPENDENCIES[productId];
        if (parentId) {
            await CartService.addToCart(bigIntUserId, parentId);
        }

        // Идемпотентная проверка наличия товара
        const existing = await prisma.cartItem.findFirst({
            where: {
                userId: bigIntUserId,
                productId: productId
            }
        });

        if (existing) {
            return existing;
        }

        return await prisma.cartItem.create({
            data: {
                userId: bigIntUserId,
                productId: productId
            }
        });
    }

    /**
     * Удаляет товар из корзины пользователя
     */
    static async removeFromCart(userId: bigint, productId: ProductId): Promise<any> {
        const bigIntUserId = BigInt(userId);

        // Каскадное удаление: если удаляем родительскую услугу, удаляем и зависящие от неё
        const dependentChildren = (Object.entries(PRODUCT_DEPENDENCIES) as [ProductId, ProductId | null][])
            .filter(([_, parent]) => parent === productId)
            .map(([child, _]) => child);

        for (const childId of dependentChildren) {
            await CartService.removeFromCart(bigIntUserId, childId);
        }

        return await prisma.cartItem.deleteMany({
            where: {
                userId: bigIntUserId,
                productId: productId
            }
        });
    }

    /**
     * Оформляет заказ atomically (prisma.$transaction)
     */
    static async checkout(userId: bigint, url: string) {
        const bigIntUserId = BigInt(userId);

        if (!url) {
            throw new BadRequestError("Не указан URL для анализа");
        }

        const result = await prisma.$transaction(async (tx) => {
            const cartItems = await tx.cartItem.findMany({
                where: { userId: bigIntUserId }
            });

            if (cartItems.length === 0) {
                throw new BadRequestError("Cart is empty");
            }

            // Валидируем зависимости продуктов (например, SEO_MAX требует SEO_BASIC)
            const cartProductIds = new Set(cartItems.map(item => item.productId as ProductId));
            for (const productId of cartProductIds) {
                const parentId = PRODUCT_DEPENDENCIES[productId];
                if (parentId && !cartProductIds.has(parentId)) {
                    const parentName = SERVICES_CATALOG[parentId]?.name || parentId;
                    const productName = SERVICES_CATALOG[productId]?.name || productId;
                    throw new BadRequestError(`Для покупки "${productName}" в вашей корзине также должен быть "${parentName}"`);
                }
            }

            // Вычисляем точную общую стоимость
            let totalDecimal = new Prisma.Decimal(0);
            for (const item of cartItems) {
                const product = SERVICES_CATALOG[item.productId as ProductId];
                if (product) {
                    totalDecimal = totalDecimal.add(new Prisma.Decimal(product.priceCredits));
                }
            }

            // Атомарное обновление баланса для защиты от гонки данных (double-spending)
            const updateResult = await tx.user.updateMany({
                where: {
                    userId: bigIntUserId,
                    balance: { gte: totalDecimal }
                },
                data: {
                    balance: { decrement: totalDecimal }
                }
            });

            if (updateResult.count === 0) {
                throw new BadRequestError("Insufficient funds");
            }

            // Запись транзакции в лог (PaymentTransaction)
            logger.info({
                type: "withdrawal",
                amount: totalDecimal.toString(),
                status: "success",
                userId: bigIntUserId.toString()
            }, "PaymentTransaction");

            // Очищаем корзину пользователя
            await tx.cartItem.deleteMany({
                where: { userId: bigIntUserId }
            });

            // Объединяем настройки по логическому ИЛИ (Logical OR)
            const finalFlags = {
                depth: 1,
                seo: false,
                links: false,
                lighthouse: false,
                lighthouse_pro: false,
                techstack: false,
                ai_summary: false
            };

            for (const item of cartItems) {
                const product = SERVICES_CATALOG[item.productId as ProductId];
                if (product && product.flags) {
                    if (product.flags.seo) finalFlags.seo = true;
                    if (product.flags.links) finalFlags.links = true;
                    if (product.flags.lighthouse) finalFlags.lighthouse = true;
                    if (product.flags.lighthouse_pro) finalFlags.lighthouse_pro = true;
                    if (product.flags.techstack) finalFlags.techstack = true;
                    if (product.flags.ai_summary) finalFlags.ai_summary = true;
                }
            }

            // Создаем задачу на анализ
            const newJob = await tx.job.create({
                data: {
                    url,
                    type: 1, // Платный тип анализа
                    userId: bigIntUserId,
                    settings: JSON.stringify(finalFlags)
                }
            });

            return newJob;
        });

        // Отправляем задачу в очередь RabbitMQ вне транзакции
        await rabbitMQClient.sendTask({
            jobId: result.jobId,
            userId: Number(result.userId),
            url: result.url,
            status: result.status,
            type: result.type,
            settings: result.settings
        });

        return result;
    }
}
