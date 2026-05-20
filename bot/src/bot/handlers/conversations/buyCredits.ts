import { Conversation } from "@grammyjs/conversations";
import { logger } from "#core/logger.js";
import { TMyContext } from "#types/state.js";
import { Context } from "grammy";
import { createBuyCreditsMenu } from "#bot/menu/conversationMenus.js";

export async function buyCredits(
    conversation: Conversation<Context, TMyContext>,
    ctx: TMyContext
) {
    const menu = createBuyCreditsMenu(conversation);

    const promptMessage = await ctx.reply(
        `💳 <b>Пополнение баланса</b>\n\n` +
        `Пожалуйста, введите количество кредитов, которое вы хотите приобрести.\n` +
        `Курс: <b>3 Telegram Stars (⭐) = 1 кредит</b>.\n\n` +
        `<i>Отправьте числом, сколько кредитов вам нужно (например: <code>10</code>).</i>`,
        {
            reply_markup: menu,
            parse_mode: "HTML",
        }
    );

    let credits: number | null = null;

    while (true) {
        const { message, callbackQuery } = await conversation.wait();

        if (callbackQuery) {
            // Если пришел клик по кнопке (например, Отмена) - меню само обработает его
            // и вызовет conversation.halt()
            continue;
        }

        if (message?.text) {
            const text = message.text.trim();

            if (text === "/cancel" || text.toLowerCase() === "отмена") {
                try {
                    await ctx.api.deleteMessage(promptMessage.chat.id, promptMessage.message_id);
                } catch (e) {
                    // Игнорируем ошибки удаления
                }
                await ctx.reply("Операция отменена!");
                conversation.halt();
                return;
            }

            const parsed = parseInt(text, 10);
            if (!isNaN(parsed) && parsed > 0) {
                credits = parsed;
                break;
            } else {
                await ctx.reply("⚠️ Пожалуйста, введите целое положительное число или отправьте /cancel для отмены.");
            }
        } else {
            await ctx.reply("⚠️ Пожалуйста, введите количество кредитов числом.");
        }
    }

    // Удаляем предыдущее сообщение с меню
    try {
        await ctx.api.deleteMessage(promptMessage.chat.id, promptMessage.message_id);
    } catch (e) {
        // Игнорируем ошибки удаления
    }

    const stars = credits * 3;

    await ctx.reply(
        `💸 Вы выбрали пополнение на <b>${credits} кредитов</b>.\n` +
        `Стоимость: <b>${stars} Telegram Stars (⭐)</b>.\n\n` +
        `<i>(На данный момент функция оплаты находится в разработке и скоро будет доступна!)</i>`,
        { parse_mode: "HTML" }
    );
}