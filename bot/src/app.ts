import { Bot } from "grammy";
import { TMyContext } from "#types/state.js";
import { JobService } from "#services/JobService.js";
import { logger } from "#core/logger.js";

export class App {
    constructor(
        private readonly bot: Bot<TMyContext>,
        private readonly jobService: JobService
    ) {}

    public async start() {
        try {
            // запускаем фоновые сервисы
            this.jobService.startPolling();

            // bot.start() блокирует дальнейшее выполнение, поэтому он идет последним
            await this.bot.start({
                onStart: ({ username }) => {
                    logger.info({
                        msg: "Bot running!",
                        username,
                    });
                },
            });
        } catch (error) {
            logger.fatal(error, "Failed to start application");
            process.exit(1);
        }
    }
}