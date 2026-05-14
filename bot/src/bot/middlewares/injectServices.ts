import { JobService } from "#services/JobService.js";
import { UserService } from "#services/UserService.js";
import { TMyContext } from "#types/state.js";
import { NextFunction } from "grammy/web";

export function createInjectServices(
    jobService: JobService,
    userService: UserService,
) {
    return async (ctx: TMyContext, next: NextFunction) => {
        ctx.jobService = jobService;
        ctx.userService = userService;
        await next();
    };
}
