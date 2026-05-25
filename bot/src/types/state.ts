import { JobService } from "#services/JobService.js";
import { UserService } from "#services/UserService.js";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import { Context, SessionFlavor } from "grammy";

export enum ELanguages {
    ru = "RU",
    en = "EN",
}

export interface ISessionData {
    language: ELanguages;
    currentUrl: string | null;
}

export type TMyContext = ConversationFlavor<
    Context & SessionFlavor<ISessionData>
> & {
    jobService: JobService;
    userService: UserService;
}
export type TMyConversation = Conversation<TMyContext>;
