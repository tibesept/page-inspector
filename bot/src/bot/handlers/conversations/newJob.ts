import { Conversation } from "@grammyjs/conversations";
import { logger } from "#core/logger.js";
import { TMyContext } from "#types/state.js";
import { Context } from "grammy";
import {
    createMainMenu,
} from "#bot/menu/conversationMenus.js";
import { getSettingsText } from "#bot/menu/helpers.js";

const RegexURL =
    /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;


export async function newJob(
    conversation: Conversation<Context, TMyContext>,
    ctx: TMyContext,
    userUrl: string,
) {
    let url: string | undefined = userUrl;


    if (!url || !ctx.from?.id) {
        logger.warn(`invalid url or ctx.from.id: ${url} \n ${ctx.from?.id}`);
        return;
    }

    // ===== MENU =====
    
    // читаем сессию. ТОЛЬКО ТАК !!!
    const session = await conversation.external((ctx: TMyContext) => ctx.session);
    const settingsBuffer = { ...session.analyzerSettings };

    // Проверяем баланс и сбрасываем платные фичи если средств не хватает.
    // Делаем это на входе, чтобы меню сразу отражало корректное состояние.
    const user = await conversation.external((ctx: TMyContext) => ctx.userService.getUserById(ctx.from!.id));

    // FIXME: хардкод стоимости платной фичи lighthouse_pro (10 кредитов)
    const LIGHTHOUSE_PRO_COST = 10;

    if (settingsBuffer.lighthouse_pro && (!user || user.balance < LIGHTHOUSE_PRO_COST)) {
        settingsBuffer.lighthouse_pro = false;
        logger.debug(`User ${ctx.from.id} had lighthouse_pro enabled but balance is insufficient (${user?.balance ?? 0}/${LIGHTHOUSE_PRO_COST}). Resetting.`);
    }

    const main = createMainMenu(conversation, url, settingsBuffer);

    const preRunMessage = await ctx.reply(getSettingsText(settingsBuffer), {
        reply_markup: main,
        parse_mode: "HTML",
    });

    // ждем ТОЛЬКО callback_query от меню
    // если придет текст/фото/любое другое сообщение - выход из диалога
    await conversation.waitUntil(
        (ctx) => ctx.callbackQuery !== undefined,
        {
            otherwise: async (ctx) => {
                await ctx.api.deleteMessage(preRunMessage.chat.id, preRunMessage.message_id);
                await ctx.reply("Операция отменена!");
                conversation.halt();
            }
        }
    );
}