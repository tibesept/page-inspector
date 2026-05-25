import { Bot, GrammyError, HttpError } from "grammy";
import { ApiService } from "#api/ApiService.js";
import { logger } from "#core/logger.js";
import { TMyContext } from "#types/state.js";

export class NotificationService {
    private isPolling = false;

    constructor(
        private readonly bot: Bot<TMyContext>,
        private readonly apiService: ApiService,
        private readonly intervalMs: number = 30000 // default 30s
    ) {}

    public startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;
        logger.info(`Starting Notification polling every ${this.intervalMs}ms`);
        this.poll();
    }

    public stopPolling() {
        this.isPolling = false;
    }

    private async poll() {
        if (!this.isPolling) return;

        try {
            const notifications = await this.apiService.getUnsentNotifications();

            for (const notif of notifications) {
                try {
                    await this.bot.api.sendMessage(notif.userId, notif.message, {
                        parse_mode: "Markdown"
                    });
                    
                    // Mark as sent
                    await this.apiService.markNotificationSent(notif.id);
                    logger.info(`Sent notification ${notif.id} to user ${notif.userId}`);
                    
                    // Small delay to respect Telegram rate limits
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (error) {
                    if (error instanceof GrammyError) {
                        logger.error(`GrammyError sending notification ${notif.id}: ${error.description}`);
                        if (error.error_code === 429) {
                            const retryAfter = error.parameters?.retry_after || 5;
                            logger.warn(`Rate limit hit, sleeping for ${retryAfter} seconds`);
                            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                            // We don't mark as sent, it will be retried on next poll
                            break; 
                        } else if (error.error_code === 403) {
                            // User blocked the bot. Mark as sent to stop retrying.
                            logger.warn(`User ${notif.userId} blocked the bot, marking notification as sent to avoid loop.`);
                            await this.apiService.markNotificationSent(notif.id);
                        }
                    } else if (error instanceof HttpError) {
                        logger.error(error, `HttpError sending notification ${notif.id}: ${error.message}`);
                    } else {
                        logger.error(error, `Unknown error sending notification ${notif.id}`);
                    }
                }
            }
        } catch (error) {
            logger.error(error, "Failed to fetch notifications during polling");
        }

        // Schedule next poll
        if (this.isPolling) {
            setTimeout(() => this.poll(), this.intervalMs);
        }
    }
}
