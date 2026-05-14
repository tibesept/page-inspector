import { JobTask, JobWorkerResultDTO } from "../types.js";
import { apiService } from "../ApiService/index.js";
import logger from "../logger.js";
import PageAnalyzer, { PageAnalysisResult } from "../PageAnalyzer/index.js";

type TSerializedResult = {
    success: boolean;
    result: string;
}

export default class TaskProcessor {

    private task: JobTask;
    private analyzer: PageAnalyzer;

    constructor(task: JobTask) {
        this.task = task;

        this.analyzer = new PageAnalyzer(this.task.type, this.task.settings)
    }

    async processTask() {
        const task = this.task;

        logger.info(task, `Processing task`);

        const doJobExist = await apiService.doJobExist(task.jobId);

        logger.info(doJobExist, "Do job exist?:");

        if (!doJobExist) {
            logger.fatal(task, "Job do not exist!");
            return;
        }

        try {
            const analysingResult = await this.analyzer.parsePage(
                task.url,
                (status) => {
                    // Отправляем статус асинхронно, не блокируя парсинг
                    apiService.updateJobStatus(task.jobId, status).catch(err => {
                        logger.warn({ err }, `Failed to update job status to ${status}`);
                    });
                }
            );
            const serializedResult = this.serializeAnalyzerOutput(analysingResult);
            await this.updateJob(serializedResult);
        } catch (err) {
            logger.error({ err }, "Task processing failed, marking job as failed");
            await apiService.updateJobTask(task.jobId, {
                status: "failed",
                result: "",
            });
            throw err; // пробрасываем дальше, чтобы rabbit.ts тоже обработал (ретрай/DLQ)
        }
    }


    private serializeAnalyzerOutput(analyzed: PageAnalysisResult): TSerializedResult {
        logger.debug("Preparing parsing result");

        let success = true;
        let result = "";

        if(!analyzed?.image) {
            return {
                success,
                result
            }
        }

        try {
            const data: JobWorkerResultDTO = {
                screenshot: analyzed.image.toString("base64"),
                status: analyzed.response?.status() || null,
                seo: (analyzed.seoData || analyzed.brokenLinks) ? {
                    title: analyzed.seoData?.title || null,
                    description: analyzed.seoData?.description || null,
                    h1: analyzed.seoData?.h1 || null,
                    linksCount: analyzed.seoData?.linksCount ?? null, // число
                    internalLinks: analyzed.seoData?.internalLinks ?? null, // число
                    externalLinks: analyzed.seoData?.externalLinks ?? null, // число
                    brokenLinks: analyzed.brokenLinks || null, // массив
                } : null,
                robotsTxtExists: analyzed.robotsTxt !== null,
                lighthouse: analyzed.lighthouse || null,
                techStack: analyzed.techStack || null
            };

            result = JSON.stringify(data);
        } catch(e) {
            logger.error(e, "Error during serializing parsing result")
            success = false
        }

        return {
            success,
            result
        }
        
    }

    private async updateJob(data: TSerializedResult) {
        logger.debug("Updating job");
        const task = this.task;

        const statusMap: Record<number, string> = {
            0: "failed", // status = false
            1: "ready"  // status = true
        }

        let status = statusMap[Number(data.success)]; // меппим результат сериализации в текущий статус
        let result = data.result;

        try {
            await apiService.updateJobTask(task.jobId, {
                status,
                result
            });

            logger.info("Job done.");
        } catch (error) {
            await apiService.updateJobTask(task.jobId, {
                status: "failed",
                result: "",
            });
            logger.fatal("Job failed!");
        }
    }
}
