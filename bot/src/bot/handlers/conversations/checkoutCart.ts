import { Conversation } from "@grammyjs/conversations";
import { logger } from "#core/logger.js";
import { TMyContext } from "#types/state.js";
import { Context, InlineKeyboard } from "grammy";
import { JobProgressStatus, jobProgressStatusSchema } from "#api/types.js";

const RegexURL =
    /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

export async function checkoutCart(
    conversation: Conversation<Context, TMyContext>,
    ctx: TMyContext
) {
    if (!ctx.from?.id) {
        logger.warn("checkoutCart called without ctx.from.id");
        return;
    }

    // 1. Проверяем корзину
    const cart = await conversation.external(() => ctx.userService.getCart(ctx.from!.id));
    if (!cart.items || cart.items.length === 0) {
        await ctx.reply("🛒 <b>Ваша корзина пуста!</b>\nПожалуйста, добавьте услуги из каталога (/catalog) перед оформлением заказа.", { parse_mode: "HTML" });
        conversation.halt();
        return;
    }

    // 2. Спрашиваем URL или подтверждаем имеющийся из сессии
    let targetUrl: string | null = null;
    const sessionUrl = await conversation.external((ctx: TMyContext) => ctx.session.currentUrl);

    if (sessionUrl && RegexURL.test(sessionUrl)) {
        targetUrl = sessionUrl;

        // Сбрасываем URL в сессии, чтобы не застревал
        await conversation.external((ctx: TMyContext) => {
            ctx.session.currentUrl = null;
        });

        const confirmMsg = await ctx.reply(
            `🛍️ <b>Подтверждение заказа</b>\n\n` +
            `Анализируемый URL: <code>${targetUrl}</code>\n` +
            `Услуг в корзине: <b>${cart.items.length}</b>\n` +
            `Итоговая стоимость: <b>${cart.totalCost} 💎</b>\n\n` +
            `Подтверждаете списание средств с баланса и запуск анализа сайта?`,
            {
                parse_mode: "HTML",
                reply_markup: new InlineKeyboard()
                    .text("✅ Подтвердить и запустить", "confirm_checkout")
                    .text("❌ Отмена", "cancel_checkout")
            }
        );

        const event = await conversation.waitUntil(
            (ctx) => ctx.callbackQuery?.data === "confirm_checkout" || ctx.callbackQuery?.data === "cancel_checkout",
            {
                otherwise: async (ctx) => {
                    await ctx.reply("⚠️ Пожалуйста, используйте кнопки под сообщением для подтверждения или отмены.");
                }
            }
        );

        await ctx.answerCallbackQuery().catch(() => {});
        try {
            await ctx.api.deleteMessage(confirmMsg.chat.id, confirmMsg.message_id);
        } catch (e) {
            // Ignore delete error
        }

        if (event.callbackQuery?.data === "cancel_checkout") {
            await ctx.reply("Оформление заказа отменено!");
            conversation.halt();
            return;
        }
    } else {
        const promptMessage = await ctx.reply(
            `📝 <b>Оформление заказа</b>\n\n` +
            `Услуг в корзине: <b>${cart.items.length}</b>\n` +
            `Итоговая стоимость: <b>${cart.totalCost} 💎</b>\n\n` +
            `Пожалуйста, отправьте ссылку на веб-сайт, который вы хотите проанализировать (например: <code>https://example.com</code>).\n\n` +
            `<i>Отправьте ссылку или напишите <b>отмена</b> для отмены.</i>`,
            { parse_mode: "HTML" }
        );

        while (true) {
            const { message } = await conversation.wait();

            if (message?.text) {
                const text = message.text.trim();

                if (text === "/cancel" || text.toLowerCase() === "отмена") {
                    try {
                        await ctx.api.deleteMessage(promptMessage.chat.id, promptMessage.message_id);
                    } catch (e) {
                        // Ignore delete error
                    }
                    await ctx.reply("Оформление заказа отменено!");
                    conversation.halt();
                    return;
                }

                if (RegexURL.test(text)) {
                    if (!text.toLowerCase().startsWith("http")) {
                        await ctx.reply("⚠️ Ссылка должна начинаться с протокола http:// или https://");
                        continue;
                    }
                    targetUrl = text;
                    break;
                } else {
                    await ctx.reply("⚠️ Пожалуйста, введите корректный URL (например: https://google.com) или напишите 'отмена'.");
                }
            } else {
                await ctx.reply("⚠️ Пожалуйста, отправьте текстовую ссылку на веб-сайт.");
            }
        }

        // Удаляем приглашение ввести URL
        try {
            await ctx.api.deleteMessage(promptMessage.chat.id, promptMessage.message_id);
        } catch (e) {
            // Ignore delete error
        }
    }

    const progressMsg = await ctx.reply("⏳ <b>Инициализация оплаты и создания задачи...</b>", { parse_mode: "HTML" });

    // 3. Вызываем checkout
    const checkoutResult = await conversation.external(() => 
        ctx.userService.checkoutCart(ctx.from!.id, targetUrl!)
    ).catch(async (err) => {
        logger.error(err, "Error checking out cart");
        const errMsg = err.message || "";
        if (errMsg.includes("Insufficient funds")) {
            await ctx.api.editMessageText(progressMsg.chat.id, progressMsg.message_id, "❌ <b>Недостаточно средств на балансе!</b>\nПожалуйста, пополните баланс через команду /me.", { parse_mode: "HTML" });
        } else {
            await ctx.api.editMessageText(progressMsg.chat.id, progressMsg.message_id, "❌ <b>Произошла ошибка при оформлении заказа.</b>\nПожалуйста, попробуйте позже.", { parse_mode: "HTML" });
        }
        return null;
    });

    if (!checkoutResult || !checkoutResult.success) {
        conversation.halt();
        return;
    }

    const job = checkoutResult.job;

    // 4. Запускаем асинхронный пуллинг статуса без блокировки бота
    const pollJob = async () => {
        const PROGRESS_MAP: Partial<Record<JobProgressStatus | "created", string>> = {
            "pending": "⏳ <b>В очереди...</b>",
            "created": "⏳ <b>В очереди...</b>",
            "starting_browser": "🖥 <b>Запуск браузера...</b>",
            "page_loaded": "✅ <b>Страница загружена</b>",
            "running_lighthouse": "🔥 <b>Lighthouse анализирует метрики...</b>",
            "detecting_tech": "💻 <b>Определение стека технологий...</b>",
            "checking_links": "🔗 <b>Проверка ссылок...</b>",
            "generating_report": "🤖 <b>Формирование отчета...</b>",
            "generating_ai_summary": "🧠 <b>Нейросеть пишет резюме...</b>",
            "ready": "✨ <b>Отчет готов! Отправляем...</b>",
            "failed": "❌ <b>Ошибка при выполнении анализа</b>",
            "sent": "✨ <b>Отчет отправлен!</b>",
            "summary_sent": "✨ <b>Отчет отправлен!</b>"
        };

        let lastStatus = "";
        let isPolling = true;

        while (isPolling) {
            try {
                const currentJob = await ctx.jobService.getJobById(job.jobId);
                if (!currentJob) {
                    isPolling = false;
                    break;
                }

                if (currentJob.status !== lastStatus) {
                    lastStatus = currentJob.status;

                    let text = `🔄 <b>Статус: ${currentJob.status}</b>`;
                    const parsedStatus = jobProgressStatusSchema.safeParse(currentJob.status);
                    if (parsedStatus.success) {
                        text = PROGRESS_MAP[parsedStatus.data] || text;
                    } else if (currentJob.status === "created") {
                        text = PROGRESS_MAP["created"] || text;
                    }

                    await ctx.jobService.updateProgressMessage(progressMsg.chat.id, progressMsg.message_id, text);
                }

                if (["ready", "failed", "sent", "summary_sent"].includes(currentJob.status)) {
                    isPolling = false;
                    if (["ready", "sent", "summary_sent"].includes(currentJob.status)) {
                        await ctx.jobService.deleteProgressMessage(progressMsg.chat.id, progressMsg.message_id);
                    }
                }
            } catch (e) {
                logger.error(e, "Error in job polling loop, will retry");
            }

            if (isPolling) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    };

    pollJob();
    conversation.halt();
}
