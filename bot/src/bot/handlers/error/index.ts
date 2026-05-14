import { BotError } from "grammy";
import { logger } from "#core/logger.js";

import { TMyContext } from "#types/state.js";

export async function errorHandler(err: BotError<TMyContext>) {
    logger.error(err, "Error!"); // err включает в себя всю важную инфу, в том числе контекст
}
