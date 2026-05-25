import { Context } from "grammy";
import { ELanguages, ISessionData } from "#types/state.js";
export function initial(): ISessionData {
    return {
        language: ELanguages.en,
        currentUrl: null,
    };
}

export function getSessionKey(ctx: Context): string | undefined {
    return ctx.from?.id.toString();
}
