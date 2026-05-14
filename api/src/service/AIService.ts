import { Job } from "@prisma/client";
import OpenAI from 'openai';
import * as AIErrors from "../errors/ai";
import { config } from "../config";
import logger from "../logger";
import { JobAnalyzerSettingsDB, JobWorkerResultDTO } from "../types";

type AIInput = {
    jobId: number;
    userId: number;
    url: string;
    result: Omit<JobWorkerResultDTO, "screenshot">,
    settings: JobAnalyzerSettingsDB,
    status: string;
}

class AIService {
    private openai: OpenAI | null;

    constructor(ai_url: string, ai_api_key: string) {   
        try {
            this.openai = new OpenAI({
                baseURL: ai_url,
                apiKey: ai_api_key,
            });
        } catch(err) {
            this.openai = null;
            logger.error(err, "connection openai error")
            throw new AIErrors.AIConnectionError(err instanceof Error ? err : undefined)
        }
    }

    async getSummary(input: AIInput): Promise<string | null> {
        if(!this.openai) {
            logger.error("no openai");
            throw new AIErrors.AIGettingSummaryError(new Error("No openai connection"));
        }
        try {
            const response = await this.openai.chat.completions.create({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional WEB developer and SEO analyst with 15 years experience. 
You are being given a results of automatic SEO analysis. You need to explain the analysis: simple, but correctly. 

Dont use any formatting except <b> and <i> tags. Use - symbol for lists 

Ты говоришь на русском.`
                    },
                    {
                        role: 'user',
                        content: `Here is analysis. Explain it (shortly). If there is issues, give me recommendations. Ответь на русском. \n<analysis>${JSON.stringify(input)}</analysis>`
                    }
                ],
                temperature: 0.7,
                max_tokens: 700,
            });

            const summary = response.choices[0].message.content;
            return summary;

        } catch (err) {
            logger.error(err, "unknown error");
            // return null;
            throw new AIErrors.AIGettingSummaryError(err instanceof Error ? err : undefined);
        }
    }
}

export const aiService = new AIService(config.ai_url, config.ai_api_key);