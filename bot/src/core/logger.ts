import { Context, NextFunction } from "grammy";
import { pino } from "pino";
import { config } from "#core/config.js";
import { colorize } from "json-colorizer";

const LOG_LEVEL = config.env === "dev" ? "debug" : "info";

export const logger = pino({
    level: LOG_LEVEL,
    transport: {
        targets: [
            {
                target: "pino-pretty",
                level: LOG_LEVEL,
                options: {
                    ignore: "pid,hostname",
                    colorize: true,
                    translateTime: true,
                },
            },
        ],
    },
});

export async function loggerMiddleware(
    ctx: Context,
    next: NextFunction,
): Promise<void> {
    logger.debug(
        colorize({
            msg: ctx.msg,
        }),
    );
    await next();
}
