import { Conversation } from "@grammyjs/conversations";
import { logger } from "#core/logger.js";
import { TMyContext } from "#types/state.js";
import { Context } from "grammy";
import { createBuyCreditsMenu } from "#bot/menu/conversationMenus.js";
import { TELEGRAM_STARS_RATE } from "@page-inspector/shared";

export async function buyCredits(
    conversation: Conversation<Context, TMyContext>,
    ctx: TMyContext
) {
    const menu = createBuyCreditsMenu(conversation);

    const promptMessage = await ctx.reply(
        `💳 <b>Пополнение баланса</b>\n\n` +
        `Пожалуйста, введите количество кредитов, которое вы хотите приобрести.\n` +
        `Курс: <b>${TELEGRAM_STARS_RATE} Telegram Stars (⭐) = 1 кредит</b>.\n\n` +
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

    const stars = credits * TELEGRAM_STARS_RATE;

    await ctx.reply(
        `💸 Вы выбрали пополнение на <b>${credits} кредитов</b>.\n` +
        `Стоимость: <b>${stars} Telegram Stars (⭐)</b>.\n\n` +
        `⏳ <i>Создаем инвойс для оплаты...</i>`,
        { parse_mode: "HTML" }
    );

    try {
        if (!ctx.from?.id || !ctx.chat?.id) {
            throw new Error("Missing ctx.from.id or ctx.chat.id");
        }

        const paymentIntent = await conversation.external(() =>
            ctx.userService.createPaymentIntent(ctx.from!.id, credits!, stars)
        );

        await ctx.api.sendInvoice(
            ctx.chat.id,
            `Пополнение баланса (+${credits} кр.)`,
            `Покупка ${credits} кредитов для PageInspector`,
            paymentIntent.id,
            "XTR",
            [{ label: "Telegram Stars", amount: stars }]
        );
    } catch (err) {
        logger.error(err, "Failed to create payment intent or send invoice");
        await ctx.reply("❌ Не удалось создать инвойс для оплаты. Пожалуйста, попробуйте позже.");
    }
}