import { Context } from "grammy";
import { ELanguages, IAnalyzerSettings, ISessionData } from "#types/state.js";

export const defaultAnalyzerSettings: IAnalyzerSettings = {
    links: false,
    seo: true,
    lighthouse: false,
    lighthouse_pro: false,
    techstack: false,
    ai_summary: false
};

export function initial(): ISessionData {
    return {
        language: ELanguages.en,
        currentUrl: null,
        analyzerSettingsBuffer: defaultAnalyzerSettings,
        analyzerSettings: defaultAnalyzerSettings
    };
}

export function getSessionKey(ctx: Context): string | undefined {
    return ctx.from?.id.toString();
}
