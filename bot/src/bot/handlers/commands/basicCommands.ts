import { Composer } from "grammy";
import { TMyContext } from "#types/state.js";
import { EConversations } from "#bot/handlers/conversations/index.js";

export const basicCommands = new Composer<TMyContext>();

// TODO: ЯЗЫКИ!!! EN/RU

basicCommands.command("start", async (ctx) => {
    ctx.reply(`
Привет! Бот создан для того, чтобы анализировать веб страницы. Он может предоставить много полезной информации.
Из возможностей (хотелось бы):
- Собственный баланс (в кредитах. Пополнение через TON)
- Возможность тратить кредиты на анализ веб страниц
- Смена языка. RU/EN

БЕСПЛАТНЫЙ АНАЛИЗ:
- Скриншот
- Фигня всякая по мелочам
- Ограничение 1 раз в день
- Нет отчета

ПЛАТНЫЙ АНАЛИЗ
Выбор глубины анализа (цены разные)
- Скришот
- Куча инфы, lighthouse, краулинг вглубь по ссылкам (глубина настраиваема. Цена зависит от глубины)
- Полный отчет в формате PDF
- Краткое резюме от ИИ (DeepSeek API) об основных ошибках и возможных исправлениях

На данный момент реализовано не всё, что хотелось бы. 

Для анализа просто отправьте ссылку (http/https).
`);
});


basicCommands.command("me", async (ctx) => {
    if (!ctx.from?.id) {
        return;
    }

    // await ctx.api.sendChatAction(ctx?.chatId || 0, "typing") // печатает

    // TODO: забор данных о юзере из сессии, без повторного запроса
    // getUser выполняется в middleware и кладет данные в сессию
    const data = await ctx.userService.getUserById(ctx.from.id);

    await ctx.reply(
        `👤 <b>Ваш профиль</b>\n\nID: <code>${ctx.from.id}</code>\nБаланс: <b>${data.balance} кредитов</b>`, 
        { parse_mode: "HTML" }
    );
});

basicCommands.on("message:entities:url", async (ctx) => {
    const text = ctx.message.text;
    const urls = ctx.msg.entities
      ?.filter(entity => entity.type === "url")
      .map(entity => text.substring(entity.offset, entity.offset + entity.length));

    if(!urls[0]?.toLowerCase()?.startsWith("http")) {
        await ctx.reply("Ссылка должна начинаться с протокола http или https.")
        return;
    }

    await ctx.conversation.enter(EConversations.newJob, urls[0]);
})
