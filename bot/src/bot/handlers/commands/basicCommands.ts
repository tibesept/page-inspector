import { Composer, InlineKeyboard } from "grammy";
import { TMyContext } from "#types/state.js";
import { EConversations } from "#bot/handlers/conversations/index.js";
import { logger } from "#core/logger.js";

export const basicCommands = new Composer<TMyContext>();

// TODO: ЯЗЫКИ!!! EN/RU

basicCommands.command(["start", "help"], async (ctx) => {
    const text = 
        `🚀 <b>Добро пожаловать в PageInspector!</b>\n\n` +
        `Умный бот-ассистент для глубокого аудита и мониторинга веб-страниц. Я помогу вам оценить качество оптимизации, производительность и стабильность вашего сайта! 📈\n\n` +
        `📌 <b>Что я умею:</b>\n` +
        `• 🔍 <b>SEO-анализ</b> — проверка структуры страницы, заголовков и мета-тегов.\n` +
        `• 🔗 <b>Анализ ссылок</b> — поиск битых ссылок и оценка перелинковки.\n` +
        `• ⚡ <b>Lighthouse-аудит</b> — детальный анализ скорости (LCP, TBT, CLS), доступности и лучших практик.\n` +
        `• 🧠 <b>ИИ-Резюме</b> — автоматические рекомендации и выводы на основе искусственного интеллекта.\n` +
        `• ⏱️ <b>Авто-проверки</b> — регулярные автоматические чек-апы сайтов по расписанию.\n\n` +
        `💡 <b>Как начать?</b>\n` +
        `Просто <b>отправьте мне ссылку</b> на сайт (например: <code>https://example.com</code>) и выберите нужный пакет услуг в каталоге!\n\n` +
        `🛠️ <b>Быстрые команды:</b>\n` +
        `/me — Ваш профиль, баланс и пополнение\n` +
        `/monitors — Управление авто-проверками\n` +
        `/catalog — Каталог доступных видов аудита\n` +
        `/cart — Ваша корзина выбранных услуг`;

    const keyboard = new InlineKeyboard()
        .text("📂 Каталог услуг", "cart_catalog")
        .text("⏱️ Авто-проверки", "menu_monitors").row()
        .text("👤 Мой профиль", "menu_profile");

    await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: keyboard
    });
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
        {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard().text("💳 Пополнить баланс", "buy_credits")
        }
    );
});

basicCommands.callbackQuery("buy_credits", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter(EConversations.buyCredits);
});

basicCommands.callbackQuery("menu_profile", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from?.id) return;
    const data = await ctx.userService.getUserById(ctx.from.id);
    await ctx.reply(
        `👤 <b>Ваш профиль</b>\n\nID: <code>${ctx.from.id}</code>\nБаланс: <b>${data.balance} кредитов</b>`,
        {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard().text("💳 Пополнить баланс", "buy_credits")
        }
    );
});

basicCommands.on("message:entities:url", async (ctx) => {
    if (!ctx.from?.id) return;
    const text = ctx.message.text;
    const urls = ctx.msg.entities
        ?.filter(entity => entity.type === "url")
        .map(entity => text.substring(entity.offset, entity.offset + entity.length));

    const url = urls[0];
    if (!url) return;

    if (!url.toLowerCase().startsWith("http")) {
        await ctx.reply("Ссылка должна начинаться с протокола http или https.")
        return;
    }

    // Сохраняем URL в сессию для последующего быстрого оформления
    ctx.session.currentUrl = url;

    try {
        const cart = await ctx.userService.getCart(ctx.from.id);
        const keyboard = new InlineKeyboard();

        if (cart.items && cart.items.length > 0) {
            // В корзине уже есть товары! Предлагаем запустить анализ с текущей корзиной.
            let msgText = `🔗 <b>Обнаружена ссылка:</b> <code>${url}</code>\n\n` +
                          `В вашей корзине сейчас находится услуг: <b>${cart.items.length}</b>\n` +
                          `Итоговая стоимость: <b>${cart.totalCost} 💎</b>\n\n` +
                          `Хотите запустить анализ этого сайта с выбранными услугами?`;

            keyboard.text("🚀 Запустить и оплатить", "cart_checkout").row()
                    .text("🛒 Открыть корзину", "cart_view")
                    .text("📂 Изменить услуги", "cart_catalog");

            await ctx.reply(msgText, {
                parse_mode: "HTML",
                reply_markup: keyboard
            });
        } else {
            // Корзина пуста. Предлагаем запустить базовый SEO-анализ за 1.00 💎 или открыть каталог.
            let msgText = `🔗 <b>Обнаружена ссылка:</b> <code>${url}</code>\n\n` +
                          `Ваша корзина пуста. Вы можете быстро запустить базовый SEO-анализ всего за <b>1.00 💎</b> или открыть каталог услуг для детального аудита.`;

            keyboard.text("➕ Добавить базовый SEO (1 💎) и запустить", "cart_quick_add:SEO_BASIC").row()
                    .text("📂 Открыть каталог услуг", "cart_catalog");

            await ctx.reply(msgText, {
                parse_mode: "HTML",
                reply_markup: keyboard
            });
        }
    } catch (err) {
        logger.error(err, "Error inside message:entities:url handler");
        await ctx.reply("❌ Произошла ошибка при обработке ссылки.");
    }
});
