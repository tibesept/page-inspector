import { Context, NextFunction } from "grammy";
import { devFilter } from "#bot/filters.js";
import { UsersRepository } from "#repositories/UsersRepository.js";
import { logger } from "#core/logger.js";

export async function devCheckMiddleware(
    ctx: Context,
    next: NextFunction,
): Promise<void> {
    if (devFilter(ctx)) {
        await next();
    }
}

export function createAuthMiddleware(usersRepository: UsersRepository) {
    return async (ctx: Context, next: NextFunction): Promise<void> => {
        const userId = ctx.from?.id;

        if (!userId) {
            logger.warn("Auth middleware skipped: No user ID in context.");
            return;
        }

        try {
            const user = await usersRepository.getUserById(userId);

            // ctx.session.user = user;
            
            await next(); // Пропускаем дальше
        } catch (error) {

            logger.error(error, `Auth failed for user ${userId}.`);
            // await ctx.reply("К сожалению, у вас нет доступа к этому боту.");
        }
    };
}