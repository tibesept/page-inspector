import { Conversation } from "@grammyjs/conversations";
import { logger } from "#core/logger.js";
import { TMyContext } from "#types/state.js";
import { Context, InlineKeyboard } from "grammy";
import { renderMonitors } from "#bot/handlers/commands/monitorCommands.js";

const RegexURL =
    /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

export async function createMonitor(
    conversation: Conversation<Context, TMyContext>,
    ctx: TMyContext
) {
    if (!ctx.from?.id) {
        logger.warn("createMonitor called without ctx.from.id");
        return;
    }

    // 1. Проверяем корзину
    const cart = await conversation.external(() => ctx.userService.getCart(ctx.from!.id));
    if (!cart.items || cart.items.length === 0) {
        await ctx.reply(
            `🛒 <b>Ваша корзина услуг пуста!</b>\n\n` +
            `Для создания регулярной проверки сначала выберите услуги в каталоге услуг: /catalog.\n` +
            `После этого вернитесь сюда и создайте мониторинг со всеми выбранными услугами.`,
            { parse_mode: "HTML" }
        );
        conversation.halt();
        return;
    }

    // Показываем пользователю, какие услуги будут использоваться
    const totalCost = cart.totalCost;
    const productNames = cart.items.map(item => `• <b>${item.name}</b> (${item.price} 💎)`).join("\n");

    // 2. Спрашиваем URL
    const promptUrlMessage = await ctx.reply(
        `📝 <b>Создание регулярной авто-проверки</b>\n\n` +
        `Мы настроим регулярные проверки на основе вашей текущей корзины:\n${productNames}\n\n` +
        `Стоимость одной проверки: <b>${totalCost} 💎</b>\n\n` +
        `Пожалуйста, отправьте ссылку на веб-сайт, который хотите проверять (например: <code>https://example.com</code>).\n\n` +
        `<i>Отправьте ссылку или напишите <b>отмена</b> для выхода.</i>`,
        { parse_mode: "HTML" }
    );

    let targetUrl: string | null = null;

    while (true) {
        const { message } = await conversation.wait();

        if (message?.text) {
            const text = message.text.trim();

            if (text === "/cancel" || text.toLowerCase() === "отмена") {
                try {
                    await ctx.api.deleteMessage(promptUrlMessage.chat.id, promptUrlMessage.message_id);
                } catch (e) {}
                await ctx.reply("Создание авто-проверки отменено!");
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

    // Удаляем приглашение URL
    try {
        await ctx.api.deleteMessage(promptUrlMessage.chat.id, promptUrlMessage.message_id);
    } catch (e) {}

    // 3. Выбор интервала
    const intervalKeyboard = new InlineKeyboard()
        .text("📅 Каждый день", "interval_daily")
        .text("📅 Раз в неделю", "interval_weekly").row()
        .text("❌ Отмена", "interval_cancel");

    const promptIntervalMessage = await ctx.reply(
        `⏱️ <b>Выберите частоту авто-проверок</b> для сайта <code>${targetUrl}</code>:\n\n` +
        `• <b>Каждый день</b>: проверка запускается каждые 24 часа.\n` +
        `• <b>Раз в неделю</b>: проверка запускается каждые 7 дней.\n\n` +
        `Списание кредитов (<b>${totalCost} 💎</b>) происходит автоматически при каждом запуске.`,
        {
            parse_mode: "HTML",
            reply_markup: intervalKeyboard
        }
    );

    const event = await conversation.waitUntil(
        (ctx) =>
            ctx.callbackQuery?.data === "interval_daily" ||
            ctx.callbackQuery?.data === "interval_weekly" ||
            ctx.callbackQuery?.data === "interval_cancel",
        {
            otherwise: async (ctx) => {
                await ctx.reply("⚠️ Пожалуйста, выберите частоту кнопками или нажмите 'Отмена'.");
            }
        }
    );

    await ctx.answerCallbackQuery().catch(() => {});

    try {
        await ctx.api.deleteMessage(promptIntervalMessage.chat.id, promptIntervalMessage.message_id);
    } catch (e) {}

    if (event.callbackQuery?.data === "interval_cancel") {
        await ctx.reply("Создание авто-проверки отменено!");
        conversation.halt();
        return;
    }

    const interval = event.callbackQuery?.data === "interval_daily" ? "daily" : "weekly";
    const intervalLabel = interval === "daily" ? "каждый день" : "раз в неделю";

    // 4. Создаем мониторинг
    const productIds = cart.items.map(item => item.productId);

    const progressMsg = await ctx.reply("⏳ <b>Сохраняем регулярную проверку...</b>", { parse_mode: "HTML" });

    try {
        await conversation.external(() =>
            ctx.monitorService.createMonitor(ctx.from!.id, {
                url: targetUrl!,
                interval,
                productIds
            })
        );

        await ctx.api.editMessageText(
            progressMsg.chat.id,
            progressMsg.message_id,
            `🎉 <b>Регулярная проверка успешно создана!</b>\n\n` +
            `🔗 Сайт: <code>${targetUrl}</code>\n` +
            `⏱️ Периодичность: <b>${intervalLabel}</b>\n` +
            `💵 Стоимость запуска: <b>${totalCost} 💎</b>\n\n` +
            `Первая проверка запустится в течение ближайшей минуты. Отчеты будут приходить прямо в этот чат!`,
            { parse_mode: "HTML" }
        );

        // Показываем список всех мониторов
        await renderMonitors(ctx);
    } catch (err) {
        logger.error(err, "Failed to create scheduled monitor");
        await ctx.api.editMessageText(
            progressMsg.chat.id,
            progressMsg.message_id,
            "❌ <b>Произошла ошибка при сохранении настройки.</b>\nПожалуйста, попробуйте позже.",
            { parse_mode: "HTML" }
        );
    }

    conversation.halt();
}
