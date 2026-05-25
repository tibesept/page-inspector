import { prisma } from "../db";
import { MonitorService } from "../service/monitorService";
import { rabbitMQClient } from "../rabbit";
import logger from "../logger";

export class MonitorScheduler {
    static async runSchedulerTick() {
        try {
            const now = new Date();
            // Fetch monitors that are active and whose nextRunAt has passed
            const monitors = await prisma.scheduledMonitor.findMany({
                where: {
                    active: true,
                    nextRunAt: { lte: now }
                }
            });

            for (const monitor of monitors) {
                try {
                    // Calculate nextRunDate based on interval
                    const nextRunDate = new Date();
                    if (monitor.interval === "daily") {
                        nextRunDate.setDate(nextRunDate.getDate() + 1);
                    } else if (monitor.interval === "weekly") {
                        nextRunDate.setDate(nextRunDate.getDate() + 7);
                    } else {
                        // default fallback
                        nextRunDate.setDate(nextRunDate.getDate() + 1);
                    }

                    // Add Jitter: random offset between 1 and 300 seconds (0-5 minutes)
                    const jitterSeconds = Math.floor(Math.random() * 300) + 1;
                    nextRunDate.setSeconds(nextRunDate.getSeconds() + jitterSeconds);

                    // Execute checkout and update nextRunAt within a single transaction
                    const { jobTask } = await MonitorService.executeScheduledCheckout(monitor.id, nextRunDate);
                    
                    // POST-COMMIT: Publish task to RabbitMQ
                    await rabbitMQClient.sendTask(jobTask);
                    logger.info(`Scheduled monitor ${monitor.id} executed successfully. Job published.`);
                } catch (error: any) {
                    logger.error({ err: error, monitorId: monitor.id }, "Failed to execute monitor checkout");

                    if (error.message === "INSUFFICIENT_FUNDS") {
                        // Handle insufficient funds by deactivating the monitor and sending a notification
                        await prisma.$transaction([
                            prisma.scheduledMonitor.update({
                                where: { id: monitor.id },
                                data: { active: false }
                            }),
                            prisma.notification.create({
                                data: {
                                    userId: monitor.userId,
                                    message: `🚨 *Авто-проверка приостановлена!*\n\nУ вас недостаточно кредитов на балансе для проведения регулярного анализа сайта ${monitor.url}.\n\nПожалуйста, пополните баланс и включите мониторинг заново.`
                                }
                            })
                        ]);
                        logger.warn(`Monitor ${monitor.id} deactivated due to insufficient funds`);
                    }
                }
            }
        } catch (error) {
            logger.error({ err: error }, "MonitorScheduler tick failed");
        }
    }

    static start(intervalMs: number = 60000) {
        logger.info(`Starting MonitorScheduler with interval ${intervalMs}ms`);
        // Run immediately once
        this.runSchedulerTick();
        
        setInterval(() => {
            this.runSchedulerTick();
        }, intervalMs);
    }
}
