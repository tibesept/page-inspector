import Emoji from "#bot/emoji.js";
import { IAnalyzerSettings } from "#types/state.js";

export interface ISettingsToggle {
    label: string;
    key: keyof IAnalyzerSettings,
    parent?: keyof IAnalyzerSettings,
    child?: keyof IAnalyzerSettings
}

export const settingToggles: ISettingsToggle[] = [
    { label: "SEO-анализ", key: "seo", child: "links" },
    { label: "SEO: битые ссылки", key: "links", parent: "seo" },

    { label: "Аудит LightHouse", key: "lighthouse", child: "lighthouse_pro" },
    { label: "💎 Lighthouse PRO (10 кредитов)", key: "lighthouse_pro", parent: "lighthouse" },

    // { label: "Стек технологий", key: "techstack" },
    { label: "Резюме от ИИ", key: "ai_summary" },
];


export function getSettingsText(analyzerSettings: IAnalyzerSettings): string {
    return `${Emoji.gear} <b>Текущие настройки</b>:\n\n${settingToggles
        .map(
            (i) =>
                ` - <b>${i.label}</b>: ${analyzerSettings[i.key] ? Emoji.yes : Emoji.no}`,
        )
        .join("\n")}`;
}