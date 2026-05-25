import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { FileAdapter } from "@grammyjs/storage-file";

import { logger, loggerMiddleware } from "#core/logger.js";
import { createAuthMiddleware, devCheckMiddleware } from "#bot/middlewares/auth.js";
import * as useSession from "#bot/session.js";
import { ISessionData, TMyContext } from "#types/state.js";

// ===== HANDLERS =====
import { errorHandler } from "#bot/handlers/error/index.js";
// commands
import { basicCommands } from "#bot/handlers/commands/basicCommands.js";
import { cartCommands } from "#bot/handlers/commands/cartCommands.js";
import { monitorCommands } from "#bot/handlers/commands/monitorCommands.js";
// conversations
import { buyCredits, checkoutCart, createMonitor } from "#bot/handlers/conversations/index.js";

// ===== API ===== (используем только как типы)
// repositories
import { UsersRepository } from "#repositories/UsersRepository.js";
// services
import { JobService } from "#services/JobService.js";
import { UserService } from "#services/UserService.js";
import { MonitorService } from "#services/MonitorService.js";
import { createInjectServices } from "./middlewares/injectServices.js";


export function configureBot(
    bot: Bot<TMyContext>,
    usersRepository: UsersRepository,
    userService: UserService,
    jobService: JobService,
    monitorService: MonitorService,
): void {
    // SESSION
    bot.use(
        session({
            initial: useSession.initial,
            getSessionKey: useSession.getSessionKey,
            storage: new FileAdapter<ISessionData>({
                dirName: "sessions",
            }),
        }),
    );
    const injectServices = createInjectServices(jobService, userService, monitorService);

    // MIDDLEWARES
    bot.use(loggerMiddleware);
    bot.use(devCheckMiddleware);
    bot.use(createAuthMiddleware(usersRepository));

    // SERVICE INJECTION
    bot.use(injectServices);

    // CONVERSATIONS
    bot.use(conversations());
    bot.use(createConversation(buyCredits, { plugins: [injectServices]}));
    bot.use(createConversation(checkoutCart, { plugins: [injectServices]}));
    bot.use(createConversation(createMonitor, { plugins: [injectServices]}));

    // PRE_CHECKOUT_QUERY HANDLER
    bot.on("pre_checkout_query", async (ctx) => {
        try {
            if (!ctx.from?.id) {
                await ctx.answerPreCheckoutQuery(false, "Не удалось идентифицировать пользователя");
                return;
            }
            // Проверяем работу БД / доступность пользователя
            await ctx.userService.getUserById(ctx.from.id);
            await ctx.answerPreCheckoutQuery(true);
        } catch (error) {
            logger.error(error, "Pre-checkout query failed");
            await ctx.answerPreCheckoutQuery(false, "Технические неполадки. Сервис временно недоступен.");
        }
    });

    // SUCCESSFUL_PAYMENT HANDLER
    bot.on("message:successful_payment", async (ctx) => {
        const payment = ctx.message.successful_payment;
        const payload = payment.invoice_payload;
        const telegramChargeId = payment.telegram_payment_charge_id;
        const userId = ctx.from?.id;

        if (!userId) {
            logger.error("No user ID in successful payment");
            return;
        }

        logger.info({ userId, payload, telegramChargeId }, "Successful payment event received");

        try {
            // Подтверждаем в API
            await ctx.userService.confirmPayment(payload, telegramChargeId);
            
            // Запрашиваем обновленного юзера с новым балансом
            const user = await ctx.userService.getUserById(userId);

            await ctx.reply(
                `🎉 <b>Оплата успешно завершена!</b>\n\n` +
                `Кредиты успешно начислены на ваш баланс.\n` +
                `Текущий баланс: <b>${user.balance} кредитов</b>.\n\n` +
                `Спасибо за покупку! 🚀`,
                { parse_mode: "HTML" }
            );
        } catch (error) {
            logger.error(error, "Error confirming successful payment in API");

            // КРИТИЧЕСКИЙ ШАГ: Возвращаем звезды пользователю, если не удалось начислить баланс!
            try {
                logger.warn({ userId, telegramChargeId }, "Initiating automatic refund due to API error");
                await ctx.api.refundStarPayment(userId, telegramChargeId);
                
                await ctx.reply(
                    `⚠️ <b>Произошла ошибка при начислении кредитов!</b>\n\n` +
                    `К сожалению, мы не смогли начислить кредиты на ваш баланс из-за технических неполадок.\n` +
                    `⭐ <b>Все потраченные Telegram Stars были автоматически возвращены на ваш счет.</b>\n\n` +
                    `Пожалуйста, попробуйте совершить покупку позже.`,
                    { parse_mode: "HTML" }
                );
            } catch (refundError) {
                logger.error(refundError, "CRITICAL ERROR: Failed to refund stars!");
                await ctx.reply(
                    `❌ <b>Критическая ошибка при обработке платежа!</b>\n\n` +
                    `Мы не смогли завершить начисление кредитов, а также произошла ошибка при автоматическом возврате средств.\n` +
                    `Пожалуйста, обратитесь в службу поддержки, и мы решим проблему вручную.\n` +
                    `ID платежа: <code>${payload}</code>`,
                    { parse_mode: "HTML" }
                );
            }
        }
    });

    // HANDLERS
    bot.use(basicCommands);
    bot.use(cartCommands);
    bot.use(monitorCommands);

    // ERROR HANDLER
    bot.catch(errorHandler);
}
