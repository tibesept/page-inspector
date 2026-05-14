import { z } from "zod";
import { IAppConfig } from "#core/config.js";
import { logger } from "#core/logger.js";

/**
 * Отправка HTTP запросов к API
 */
export class ApiHttpClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(config: IAppConfig['api']) {
        this.baseUrl = config.host;
        this.apiKey = config.key;
        logger.info("HttpClient instance created");
    }


    public get<T>(path: string, schema: z.ZodSchema<T>): Promise<T> {
        return this.request(path, "GET", schema);
    }

    public post<T>(
        path: string,
        body: Record<string, unknown>,
        schema: z.ZodSchema<T>,
    ): Promise<T> {
        return this.request(path, "POST", schema, body);
    }

    public put<T>(
        path: string,
        body: Record<string, unknown>,
        schema: z.ZodSchema<T>,
    ): Promise<T> {
        return this.request(path, "PUT", schema, body);
    }

    private async request<T>(
        path: string,
        method: string,
        schema: z.ZodSchema<T>,
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

        logger.debug(body,
            `Doing ${method} request to URL: ${url}${body ? ' with body:' : ''}`
        );

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
                logger.error(result.error, `HTTP Request ${url} Failed:\n`);

                throw new Error(
                    `Invalid data from API: ${result.error.message}`,
                );
            }

            return result.data;
        } catch (error) {
            logger.error(error, `HTTP Request Failed (${url}) :\n`);
            throw error;
        }
    }
}