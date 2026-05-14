import { pino } from "pino";
import { config } from "./config";

const LOG_LEVEL = config.env === "dev" ? "debug" : "info";

export default pino({
    level: LOG_LEVEL,
    transport: {
        targets: [
            {
                target: "pino-pretty",
                level: LOG_LEVEL,
                options: {
                    ignore: "pid,hostname",
                    colorize: true,
                    translateTime: true
                }
            }
        ]
    }
})