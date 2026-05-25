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

            // устанавливаем меню команд
            await this.bot.api.setMyCommands([
                { command: "start", description: "Запустить бота / Главное меню" },
                { command: "help", description: "Показать справку и возможности" },
                { command: "me", description: "Ваш профиль и баланс" },
                { command: "monitors", description: "Управление авто-проверками" },
                { command: "catalog", description: "Каталог услуг" },
                { command: "cart", description: "Ваша корзина услуг" },
            ]);

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