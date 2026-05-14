import { rabbitMQClient as rabbit } from "./rabbit.js";
import logger from "./logger.js";
import { setupGlobalErrorHandlers } from "./errors/errorHandler.js";

import { config } from "./config.js";
import { jobTaskSchema } from "./types.js";

import TaskProcessor from "./TaskProcessor/index.js";

import dns from 'dns';
dns.setDefaultResultOrder('ipv4first'); // используем ipv4

logger.info(config.args, "Args:");
logger.info(`Chrome path: ${config.chrome_executable_path}`);

setupGlobalErrorHandlers();

async function startWorker() {
    await rabbit.consume(async (msg) => {

        const task = jobTaskSchema.parse(JSON.parse(msg.content.toString()));
        const processor = new TaskProcessor(task);
        await processor.processTask();
        logger.info("Task processed");

    }, { prefetch: 1 });

    process.on("SIGINT", () => rabbit.close());
    process.on("SIGTERM", () => rabbit.close());
}

startWorker();
