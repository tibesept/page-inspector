import logger from "../logger.js";

export function setupGlobalErrorHandlers() {
    process.on("uncaughtException", (err) => {
        logger.fatal({ err }, "Uncaught Exception");
        process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
        logger.fatal({ err: reason }, "Unhandled Rejection");
        process.exit(1);
    });
}