import { Composer, InlineKeyboard } from "grammy";
import { TMyContext } from "#types/state.js";
import { EConversations } from "#bot/handlers/conversations/index.js";
import { SERVICES_CATALOG, ProductId, CartDTO, PRODUCT_DEPENDENCIES } from "#api/types.js";
import { logger } from "#core/logger.js";

export const cartCommands = new Composer<TMyContext>();

/**
 * Вспомогательный метод для красивого рендеринга корзины
 */
async function sendOrEditCart(ctx: TMyContext, edit: boolean = false) {
    if (!ctx.from?.id) return;

    try {
        const [cart, user] = await Promise.all([
            ctx.userService.getCart(ctx.from.id),
            ctx.userService.getUserById(ctx.from.id)
        ]);

        let text = `🛒 <b>Ваша корзина услуг</b>\n\n`;
        const keyboard = new InlineKeyboard();

        if (!cart.items || cart.items.length === 0) {
            text += `Ваша корзина пуста.\n\n` +
                    `Пожалуйста, добавьте услуги из каталога, чтобы провести детальный анализ вашего сайта.\n\n` +
                    `👤 Ваш баланс: <b>${user.balance} 💎</b>`;
            
            keyboard.text("📂 Каталог услуг", "cart_catalog");
        } else {
            text += `Вы выбрали следующие услуги:\n`;
            
            cart.items.forEach((item) => {
                text += `• <b>${item.name}</b> — <code>${item.price} 💎</code>\n`;
                keyboard.text(`❌ Удалить: ${item.name.substring(0, 18)}...`, `cart_remove:${item.productId}`).row();
            });

            const total = parseFloat(cart.totalCost);
            const balance = parseFloat(user.balance.toString());

            text += `\n💵 Итого к оплате: <b>${cart.totalCost} 💎</b>\n` +
                    `👤 Ваш текущий баланс: <b>${user.balance} 💎</b>\n`;

            if (balance >= total) {
                text += `\n✅ <i>У вас достаточно средств на балансе для совершения покупки!</i>`;
                keyboard.row().text("🛍️ Оплатить с баланса", "cart_checkout");
            } else {
                const diff = (total - balance).toFixed(2);
                text += `\n⚠️ <i>Недостаточно средств. Вам не хватает <b>${diff} 💎</b>. Пожалуйста, пополните баланс!</i>`;
                keyboard.row().text("💳 Пополнить баланс", "buy_credits");
            }

            keyboard.row().text("📂 Добавить еще услуги", "cart_catalog");
        }

        if (edit) {
            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard
            }).catch(() => {});
        } else {
            await ctx.reply(text, {
                parse_mode: "HTML",
                reply_markup: keyboard
            });
        }
    } catch (err) {
        logger.error(err, "Error rendering cart");
        await ctx.reply("❌ Произошла ошибка при загрузке вашей корзины.");
    }
}

/**
 * Вспомогательный метод для красивого рендеринга каталога услуг
 */
async function sendOrEditCatalog(ctx: TMyContext, edit: boolean = false) {
    if (!ctx.from?.id) return;

    try {
        const cart = await ctx.userService.getCart(ctx.from.id);
        const keyboard = new InlineKeyboard();

        let text = `📂 <b>Каталог услуг PageInspector</b>\n\n` +
                   `Выберите и добавьте в корзину интересующие вас пакеты анализа:\n\n`;

        const catalogEntries = Object.entries(SERVICES_CATALOG) as [ProductId, typeof SERVICES_CATALOG[ProductId]][];

        catalogEntries.forEach(([id, details]) => {
            const inCart = cart.items.some(item => item.productId === id);
            
            text += `${inCart ? "✅" : "▫️"} <b>${details.name}</b>\n` +
                    `└ Стоимость: <b>${details.priceCredits.toFixed(2)} 💎</b>\n\n`;

            if (inCart) {
                keyboard.text(`✅ В корзине: ${details.name.substring(0, 15)}...`, `cart_remove:${id}`).row();
            } else {
                keyboard.text(`➕ Добавить: ${details.name.substring(0, 15)}... (+${details.priceCredits.toFixed(0)} 💎)`, `cart_add:${id}`).row();
            }
        });

        keyboard.row().text("🛒 Перейти в корзину", "cart_view");

        if (edit) {
            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard
            }).catch(() => {});
        } else {
            await ctx.reply(text, {
                parse_mode: "HTML",
                reply_markup: keyboard
            });
        }
    } catch (err) {
        logger.error(err, "Error rendering catalog");
        await ctx.reply("❌ Произошла ошибка при загрузке каталога.");
    }
}

// Команды
cartCommands.command("cart", async (ctx) => {
    await sendOrEditCart(ctx, false);
});

cartCommands.command("catalog", async (ctx) => {
    await sendOrEditCatalog(ctx, false);
});

// Колбэки переходов
cartCommands.callbackQuery("cart_view", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await sendOrEditCart(ctx, true);
});

cartCommands.callbackQuery("cart_catalog", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await sendOrEditCatalog(ctx, true);
});

// Добавление в корзину
cartCommands.callbackQuery(/^cart_add:(.+)$/, async (ctx) => {
    if (!ctx.from?.id) return;
    const productId = ctx.match[1] as ProductId;

    try {
        const cart = await ctx.userService.getCart(ctx.from.id);
        const parentId = PRODUCT_DEPENDENCIES[productId];
        
        if (parentId) {
            const hasParent = cart.items.some(item => item.productId === parentId);
            if (!hasParent) {
                // Автоматически добавляем и родительский, и дочерний продукты для удобства пользователя!
                await ctx.userService.addToCart(ctx.from.id, parentId);
                await ctx.userService.addToCart(ctx.from.id, productId);
                await ctx.answerCallbackQuery({ 
                    text: `➕ Добавлены: ${SERVICES_CATALOG[parentId].name} и ${SERVICES_CATALOG[productId].name}!` 
                }).catch(() => {});
                await sendOrEditCatalog(ctx, true);
                return;
            }
        }

        await ctx.userService.addToCart(ctx.from.id, productId);
        await ctx.answerCallbackQuery({ text: "➕ Товар добавлен в корзину!" }).catch(() => {});
        await sendOrEditCatalog(ctx, true);
    } catch (err) {
        logger.error(err, "Failed to add to cart callback");
        await ctx.answerCallbackQuery({ text: "❌ Ошибка добавления." }).catch(() => {});
    }
});

// Удаление из корзины
cartCommands.callbackQuery(/^cart_remove:(.+)$/, async (ctx) => {
    if (!ctx.from?.id) return;
    const productId = ctx.match[1] as ProductId;

    try {
        const cart = await ctx.userService.getCart(ctx.from.id);
        
        // Каскадное удаление: если удаляем базовую услугу, удаляем и зависящую от неё
        const dependentChild = (Object.entries(PRODUCT_DEPENDENCIES) as [ProductId, ProductId | null][])
            .find(([_, parent]) => parent === productId);

        if (dependentChild) {
            const childId = dependentChild[0];
            const hasChild = cart.items.some(item => item.productId === childId);
            if (hasChild) {
                // Автоматически удаляем зависимую MAX услугу при удалении BASIC услуги!
                await ctx.userService.removeFromCart(ctx.from.id, productId);
                await ctx.userService.removeFromCart(ctx.from.id, childId);
                await ctx.answerCallbackQuery({ 
                    text: `🗑️ Удалены ${SERVICES_CATALOG[productId].name} и зависимый ${SERVICES_CATALOG[childId].name}!` 
                }).catch(() => {});
                
                const messageText = ctx.callbackQuery.message?.text || "";
                if (messageText.includes("Каталог услуг")) {
                    await sendOrEditCatalog(ctx, true);
                } else {
                    await sendOrEditCart(ctx, true);
                }
                return;
            }
        }

        await ctx.userService.removeFromCart(ctx.from.id, productId);
        await ctx.answerCallbackQuery({ text: "🗑️ Товар удален из корзины!" }).catch(() => {});
        
        const messageText = ctx.callbackQuery.message?.text || "";
        if (messageText.includes("Каталог услуг")) {
            await sendOrEditCatalog(ctx, true);
        } else {
            await sendOrEditCart(ctx, true);
        }
    } catch (err) {
        logger.error(err, "Failed to remove from cart callback");
        await ctx.answerCallbackQuery({ text: "❌ Ошибка удаления." }).catch(() => {});
    }
});

// Оформление заказа
cartCommands.callbackQuery("cart_checkout", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.conversation.enter(EConversations.checkoutCart);
});

// Быстрое добавление и запуск
cartCommands.callbackQuery(/^cart_quick_add:(.+)$/, async (ctx) => {
    if (!ctx.from?.id) return;
    const productId = ctx.match[1] as ProductId;

    try {
        await ctx.userService.addToCart(ctx.from.id, productId);
        await ctx.answerCallbackQuery({ text: "➕ Услуга добавлена!" }).catch(() => {});
        await ctx.conversation.enter(EConversations.checkoutCart);
    } catch (err) {
        logger.error(err, "Failed to execute cart_quick_add");
        await ctx.answerCallbackQuery({ text: "❌ Ошибка добавления." }).catch(() => {});
    }
});
