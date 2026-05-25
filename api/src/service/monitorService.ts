import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { SERVICES_CATALOG, ProductId, JobTask } from "@page-inspector/shared";
import logger from "../logger";

export class MonitorService {
    /**
     * Executes the scheduled checkout:
     * - Wraps everything in a Prisma transaction
     * - Deducts balance
     * - Updates nextRunAt
     * - Creates Job
     * - Creates Notification
     * - Returns the task to be published to RabbitMQ
     */
    static async executeScheduledCheckout(monitorId: number, nextRunDate: Date): Promise<{ jobTask: JobTask; cost: number }> {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch monitor
            const monitor = await tx.scheduledMonitor.findUnique({
                where: { id: monitorId }
            });

            if (!monitor || !monitor.active) {
                throw new Error("MONITOR_INACTIVE_OR_NOT_FOUND");
            }

            let productIds: string[] = [];
            if (typeof monitor.productIds === "string") {
                try {
                    productIds = JSON.parse(monitor.productIds);
                } catch {
                    productIds = [];
                }
            } else if (Array.isArray(monitor.productIds)) {
                productIds = monitor.productIds as string[];
            }
            
            // 2. Calculate cost and flags
            let totalDecimal = new Prisma.Decimal(0);
            const finalFlags = {
                depth: 1,
                seo: false,
                links: false,
                lighthouse: false,
                lighthouse_pro: false,
                techstack: false,
                ai_summary: false
            };

            for (const pId of productIds) {
                const product = SERVICES_CATALOG[pId as ProductId];
                if (product) {
                    totalDecimal = totalDecimal.add(new Prisma.Decimal(product.priceCredits));
                    if (product.flags) {
                        if (product.flags.seo) finalFlags.seo = true;
                        if (product.flags.links) finalFlags.links = true;
                        if (product.flags.lighthouse) finalFlags.lighthouse = true;
                        if (product.flags.lighthouse_pro) finalFlags.lighthouse_pro = true;
                        if (product.flags.techstack) finalFlags.techstack = true;
                        if (product.flags.ai_summary) finalFlags.ai_summary = true;
                    }
                }
            }

            // 3. Deduct balance atomically
            const updateResult = await tx.user.updateMany({
                where: {
                    userId: monitor.userId,
                    balance: { gte: totalDecimal }
                },
                data: {
                    balance: { decrement: totalDecimal }
                }
            });

            if (updateResult.count === 0) {
                throw new Error("INSUFFICIENT_FUNDS");
            }

            // 4. Update monitor's nextRunAt
            await tx.scheduledMonitor.update({
                where: { id: monitor.id },
                data: { nextRunAt: nextRunDate }
            });

            // 5. Create Payment log
            logger.info({
                type: "auto_withdrawal",
                amount: totalDecimal.toString(),
                status: "success",
                userId: monitor.userId.toString()
            }, "PaymentTransaction");

            // 6. Create Job
            const newJob = await tx.job.create({
                data: {
                    url: monitor.url,
                    type: 1, // Paid type
                    userId: monitor.userId,
                    settings: JSON.stringify(finalFlags)
                }
            });
            
            // 7. Create Notification about successful charge
            await tx.notification.create({
                data: {
                    userId: monitor.userId,
                    message: `⏱️ *Авто-проверка запущенна!*\nСписано ${totalDecimal.toFixed(2)} кредитов за авто-аудит сайта ${monitor.url}.`
                }
            });

            const jobTask: JobTask = {
                jobId: newJob.jobId,
                userId: Number(newJob.userId),
                url: newJob.url,
                status: newJob.status,
                type: newJob.type,
                settings: newJob.settings
            };

            return { jobTask, cost: totalDecimal.toNumber() };
        });
    }
}
