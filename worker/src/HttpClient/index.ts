import { config } from "../config.js";
import logger from "../logger.js";

/**
 * Minimal interface matching any Zod schema's .safeParse() method.
 * Uses structural typing to avoid Zod version conflicts:
 * lighthouse depends on Zod v3 (installed locally in worker/node_modules),
 * while @page-inspector/shared uses Zod v4 (hoisted at root).
 * By using a structural interface, schemas from either version work.
 */
interface ParseSuccess<T> {
    success: true;
    data: T;
}

interface ParseError {
    success: false;
    error: { message: string };
}

interface Parseable<T> {
    safeParse(data: unknown): ParseSuccess<T> | ParseError;
}

/**
 * Отправка HTTP запросов к API
 * Класс не экспортируется, чтобы никто не мог создать второй экземпляр.
 */
class ApiHttpClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor() {
        this.baseUrl = config.api_url;
        this.apiKey = config.worker_auth_token;
        logger.debug("ApiHttpClient initialized");
    }

    public get<T>(path: string, schema: Parseable<T>): Promise<T> {
        return this.request(path, "GET", schema);
    }

    public post<T>(
        path: string,
        body: Record<string, unknown>,
        schema: Parseable<T>,
    ): Promise<T> {
        return this.request(path, "POST", schema, body);
    }

    public put<T>(
        path: string,
        body: Record<string, unknown>,
        schema: Parseable<T>,
    ): Promise<T> {
        return this.request(path, "PUT", schema, body);
    }

    private async request<T>(
        path: string,
        method: string,
        schema: Parseable<T>,
        body?: Record<string, unknown>,
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const options: RequestInit = {
            method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(4000), // таймаут
        };

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(
                    `Request error: ${response.statusText} (${response.status}). Details: ${errorData}`,
                );
            }

            const data = await response.json();
            
            const result = schema.safeParse(data);
            if (!result.success) {
                logger.error(result.error, "Zod validation error:");
                throw new Error(
                    `Invalid data from API: ${result.error.message}`,
                );
            }

            return result.data;
        } catch (error) {
            logger.error(error, `HTTP Request Failed to url: ${url}`);
            throw error;
        }
    }
}

/**
 * Клиент для HTTP запросов к API
 */
export const _apiHttpClient = new ApiHttpClient();
