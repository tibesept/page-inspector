import { Composer, InlineKeyboard } from "grammy";
import { TMyContext } from "#types/state.js";
import { EConversations } from "#bot/handlers/conversations/index.js";
import { SERVICES_CATALOG, ProductId } from "@page-inspector/shared";
import { logger } from "#core/logger.js";

export const monitorCommands = new Composer<TMyContext>();

function getMonitorCost(productIds: string[]): number {
    let total = 0;
    for (const pId of productIds) {
        const product = SERVICES_CATALOG[pId as ProductId];
        if (product) {
            total += product.priceCredits;
        }
    }
    return total;
}

export async function renderMonitors(ctx: TMyContext) {
    if (!ctx.from?.id) return;

    try {
        const monitors = await ctx.monitorService.getMonitors(ctx.from.id);

        if (!monitors || monitors.length === 0) {
            const keyboard = new InlineKeyboard().text("➕ Настроить авто-проверку", "monitor_create");
            await ctx.reply(
                `⏱️ <b>Регулярный мониторинг сайтов</b>\n\n` +
                `Вы можете настроить автоматические проверки ваших ссылок по расписанию (каждый день или раз в неделю).\n\n` +
                `У вас пока нет активных проверок. Нажмите кнопку ниже, чтобы настроить первую проверку!`,
                {
                    parse_mode: "HTML",
                    reply_markup: keyboard
                }
            );
            return;
        }

        await ctx.reply(`⏱️ <b>Ваши регулярные проверки:</b>`, { parse_mode: "HTML" });

        for (const m of monitors) {
            const cost = getMonitorCost(m.productIds);
            const services = m.productIds
                .map((pId: string) => `• ${SERVICES_CATALOG[pId as ProductId]?.name || pId}`)
                .join("\n");

            const statusEmoji = m.active ? "🟢" : "🔴";
            const statusText = m.active ? "Активен" : "Приостановлен";
            const nextRun = m.active 
                ? `<code>${new Date(m.nextRunAt).toLocaleString("ru-RU")}</code>`
                : "<i>-</i>";

            const text = 
                `🔗 <b>Сайт:</b> <code>${m.url}</code>\n` +
                `⏱️ <b>Интервал:</b> <code>${m.interval === "daily" ? "Каждый день" : "Раз в неделю"}</code>\n` +
                `💵 <b>Стоимость запуска:</b> <code>${cost.toFixed(2)} 💎</code>\n` +
                `${statusEmoji} <b>Статус:</b> <b>${statusText}</b>\n` +
                `📅 <b>Следующий запуск:</b> ${nextRun}\n\n` +
                `📦 <b>Подключенные услуги:</b>\n${services}`;

            const keyboard = new InlineKeyboard()
                .text(m.active ? "⏸️ Приостановить" : "▶️ Активировать", `monitor_toggle:${m.id}:${m.active ? "false" : "true"}`)
                .text("🗑️ Удалить", `monitor_delete:${m.id}`).row();

            await ctx.reply(text, {
                parse_mode: "HTML",
                reply_markup: keyboard
            });
        }

        // Кнопка для добавления ещё одной
        const addKeyboard = new InlineKeyboard().text("➕ Добавить еще одну проверку", "monitor_create");
        await ctx.reply("Хотите настроить мониторинг для другого сайта?", {
            reply_markup: addKeyboard
        });

    } catch (err) {
        logger.error(err, "Error in renderMonitors");
        await ctx.reply("❌ Произошла ошибка при загрузке списка регулярных проверок.");
    }
}

// /monitors command
monitorCommands.command("monitors", async (ctx) => {
    await renderMonitors(ctx);
});

// Callback to list monitors
monitorCommands.callbackQuery("menu_monitors", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await renderMonitors(ctx);
});

// Callback to start creation
monitorCommands.callbackQuery("monitor_create", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.conversation.enter(EConversations.createMonitor);
});

// Callback to toggle active status
monitorCommands.callbackQuery(/^monitor_toggle:(\d+):(true|false)$/, async (ctx) => {
    if (!ctx.from?.id) return;
    const monitorId = parseInt(ctx.match[1], 10);
    const active = ctx.match[2] === "true";

    try {
        await ctx.monitorService.toggleMonitor(ctx.from.id, monitorId, active);
        await ctx.answerCallbackQuery({
            text: active ? "▶️ Проверка активирована!" : "⏸️ Проверка приостановлена!"
        }).catch(() => {});

        // Удаляем сообщение и перерисовываем список, чтобы показать обновленное состояние
        try {
            await ctx.deleteMessage();
        } catch (e) {}

        // Если это была последняя кнопка, мы можем просто отправить обновленный список
        await renderMonitors(ctx);
    } catch (err) {
        logger.error(err, "Failed to toggle monitor");
        await ctx.answerCallbackQuery({ text: "❌ Не удалось изменить статус." }).catch(() => {});
    }
});

// Callback to delete monitor
monitorCommands.callbackQuery(/^monitor_delete:(\d+)$/, async (ctx) => {
    if (!ctx.from?.id) return;
    const monitorId = parseInt(ctx.match[1], 10);

    try {
        await ctx.monitorService.deleteMonitor(ctx.from.id, monitorId);
        await ctx.answerCallbackQuery({ text: "🗑️ Проверка успешно удалена!" }).catch(() => {});

        try {
            await ctx.deleteMessage();
        } catch (e) {}

        await renderMonitors(ctx);
    } catch (err) {
        logger.error(err, "Failed to delete monitor");
        await ctx.answerCallbackQuery({ text: "❌ Не удалось удалить проверку." }).catch(() => {});
    }
});
