import { JobService } from "#services/JobService.js";
import { UserService } from "#services/UserService.js";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import { Context, SessionFlavor } from "grammy";

export enum ELanguages {
    ru = "RU",
    en = "EN",
}

export interface IAnalyzerSettings {
    links: boolean;
    seo: boolean;
    lighthouse: boolean;
    techstack: boolean;
    ai_summary: boolean;
    lighthouse_pro: boolean;
}
export interface ISessionData {
    language: ELanguages;
    analyzerSettings: IAnalyzerSettings;
    analyzerSettingsBuffer: IAnalyzerSettings;
    currentUrl: string | null;
}

export type TMyContext = ConversationFlavor<
    Context & SessionFlavor<ISessionData>
> & {
    jobService: JobService;
    userService: UserService;
}
export type TMyConversation = Conversation<TMyContext>;
