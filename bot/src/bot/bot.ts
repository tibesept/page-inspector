import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { FileAdapter } from "@grammyjs/storage-file";

import { loggerMiddleware } from "#core/logger.js";
import { createAuthMiddleware, devCheckMiddleware } from "#bot/middlewares/auth.js";
import * as useSession from "#bot/session.js";
import { ISessionData, TMyContext } from "#types/state.js";

// ===== HANDLERS =====
import { errorHandler } from "#bot/handlers/error/index.js";
// commands
import { basicCommands } from "#bot/handlers/commands/basicCommands.js";
// conversations
import { newJob } from "#bot/handlers/conversations/index.js";

// ===== API ===== (используем только как типы)
// repositories
import { UsersRepository } from "#repositories/UsersRepository.js";
// services
import { JobService } from "#services/JobService.js";
import { UserService } from "#services/UserService.js";
import { createInjectServices } from "./middlewares/injectServices.js";


export function configureBot(
    bot: Bot<TMyContext>,
    usersRepository: UsersRepository,
    userService: UserService,
    jobService: JobService,
): void {
    // SESSION
    bot.use(
        session({
            initial: useSession.initial,
            getSessionKey: useSession.getSessionKey,
            storage: new FileAdapter<ISessionData>({
                dirName: "sessions",
            }),
        }),
    );
    const injectServices = createInjectServices(jobService, userService);

    // MIDDLEWARES
    bot.use(loggerMiddleware);
    bot.use(devCheckMiddleware);
    bot.use(createAuthMiddleware(usersRepository));

    // SERVICE INJECTION
    bot.use(injectServices);

    // CONVERSATIONS
    bot.use(conversations());
    bot.use(createConversation(newJob, { plugins: [injectServices]}));

    // HANDLERS
    bot.use(basicCommands);

    // ERROR HANDLER
    bot.catch(errorHandler);
}
