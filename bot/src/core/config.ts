import "dotenv/config";

export interface IAppConfig {
    env: "dev" | "prod";
    telegram: {
        token: string;
        botAdmins: number[];
    };

    api: {
        host: string;
        key: string;
        polling_interval_ms: number;
    };

    server: {
        host: string;
        port: number;
        webhookUrl: string;
    };
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

    telegram: {
        token: getEnv("BOT_TOKEN"),
        botAdmins: getEnv("BOT_ADMINS", (s: string) => JSON.parse(s || "")),
    },

    api: {
        host: getEnv("API_HOST"),
        key: getEnv("API_KEY"),
        polling_interval_ms: getEnv("API_POLLING_INTERVAL_MS", parseInt)
    },

    server: {
        host: getEnv("SERVER_HOST"),
        port: getEnv("SERVER_PORT", parseInt),
        webhookUrl: getEnv("WEBHOOK_URL"),
    },
};
