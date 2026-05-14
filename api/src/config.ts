import "dotenv/config";

export interface IAppConfig {
    env: "dev" | "prod";
    port: number;
    bot_auth_token: string;
    worker_auth_token: string;
    rabbit_url: string;
    rabbit_queue_name: string;
    ai_api_key: string;
    ai_url: string;
}

const getEnv = <T>(key: string, parser?: (value: string) => T): T => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Отсутствует в .env: ${key}`);
    }
    if (parser) {
        return parser(value);
    }
    return value as T;
};

export const config: IAppConfig = {
    env: getEnv("NODE_ENV"),
    port: 3000,
    bot_auth_token: getEnv("BOT_AUTH_TOKEN"),
    worker_auth_token: getEnv("WORKER_AUTH_TOKEN"),
    rabbit_url: getEnv("RABBIT_URL"),
    rabbit_queue_name: getEnv("RABBIT_QUEUE_NAME"),
    ai_api_key: getEnv("AI_API_KEY"),
    ai_url: getEnv("AI_URL"),
};
