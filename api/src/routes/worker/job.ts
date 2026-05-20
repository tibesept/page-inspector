import { Router, Request, Response } from "express";
import {
    createJobBodySchema,
    CreateJobDTO,
    jobAnalyzerSettings,
    jobSchemaDTO,
    jobWorkerResultSchema,
    updateJobBodySchema,
    updateJobStatusBodySchema,
    LIGHTHOUSE_PRO_COST,
} from "../../types";
import { JobService } from "../../service/jobService";
import { BadRequestError } from "../../errors/badRequest";
import logger from "../../logger";
import { aiService } from "../../service/AIService";
import { AIGettingSummaryError } from "../../errors/ai";
import { UserService } from "../../service/userService";

const router = Router();

// проверка существования джобы
router.get("/check/:id", async (req: Request, res: Response<Boolean>) => {
    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
        throw new BadRequestError("invalid id");
    }

    const newJob = await JobService.getJobById(jobId);

    let doJobExist = false 

    if(newJob) {
        doJobExist = true
    }

    res.status(200).json(doJobExist);
});

// обновить результат джобы
router.put("/:id", async (req: Request, res: Response<CreateJobDTO>) => {
    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
        throw new BadRequestError("invalid id");
    }

    const existingJob = await JobService.getJobById(jobId);
    if (!existingJob) {
        throw new BadRequestError("job not found");
    }

    const { result, status } = updateJobBodySchema.parse(req.body);
    const settings = jobAnalyzerSettings.parse(JSON.parse(existingJob.settings));
    
    // проверка премиума
    const user = await UserService.getUserAndCreateIfNotExists(Number(existingJob.userId));
    const PREMIUM_PRICE = LIGHTHOUSE_PRO_COST;
    let isPremiumReport = false;
    let processedResultString = result;

    if (settings.lighthouse_pro && user.balance >= PREMIUM_PRICE) {
        isPremiumReport = true;
    }

    if (!isPremiumReport) {
        // Зануляем premiumInsights до сохранения в базу, чтобы бот не вывел платные результаты бесплатно
        try {
            const parsedResult = jobWorkerResultSchema.parse(JSON.parse(result));
            if (parsedResult.lighthouse?.premiumInsights) {
                parsedResult.lighthouse.premiumInsights = null;
                processedResultString = JSON.stringify(parsedResult);
            }
        } catch (e) {
            logger.error(e, "Error stripping premium insights");
        }
    }

    const newJob = await JobService.updateJobResult(jobId, processedResultString, status);
    
    // --- AI SUMMARY ----
    if(settings.ai_summary) {
        const {
            screenshot, // скриншот нам не нужен 
            ...resultForSummary 
        } = jobWorkerResultSchema.parse(JSON.parse(newJob.result));

        // проверяем, были ли реально получены инсайты воркером (например, если сайт упал)
        if (isPremiumReport && !resultForSummary.lighthouse?.premiumInsights) {
            isPremiumReport = false; // если инсайтов нет, не списываем кредиты
        }

        // получаем резюме от ИИ и сохраняем, если все ок
        aiService.getSummary({
            jobId: newJob.jobId,
            status: newJob.status,
            userId: Number(newJob.userId),
            url: newJob.url,
            settings: settings, // чтоб ИИ понимал что пропаршено и не найдено, а чего изначально быть не должно
            result: resultForSummary
        }).then(summary => {
            if(!summary) throw new AIGettingSummaryError(new Error("No summary, nothing to update"));
            JobService.updateJobSummary(newJob.jobId, summary);
            
            if (isPremiumReport) {
                UserService.decrementBalance(Number(newJob.userId), PREMIUM_PRICE).catch(err => {
                    logger.error(err, "Failed to decrement balance after premium report generation");
                });
            }
        }).catch(err => {
            logger.error(err, "Error generating AI summary");
        });
    }

    const dto: CreateJobDTO = {
        jobId: newJob.jobId,
        userId: Number(newJob.userId),
        status: newJob.status,
    };

    res.status(201).json(dto);
});

// обновить только статус джобы
router.put("/:id/status", async (req: Request, res: Response) => {
    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
        throw new BadRequestError("invalid id");
    }

    const { status } = updateJobStatusBodySchema.parse(req.body);

    await JobService.updateJobStatus(jobId, status);

    res.status(200).json({ success: true });
});

export default router;
