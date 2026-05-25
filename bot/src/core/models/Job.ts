import { JobWorkerResultDTO, JobProgressStatus } from "#api/types.js"; // Мы можем переиспользовать тип результата
import { JobAnalyzerSettingsDB } from "#api/types.js";

export type JobStatus = JobProgressStatus | "created";

/**
 * Доменная модель джобы
 * Эта модель используется в Service Layer (JobService)
 */
export interface Job {
    jobId: number;
    userId: number;
    url: string | null;
    status: JobStatus;
    
    ai_summary: string | null;
    /**
     * Результат выполнения задачи, уже распарсенный из JSON-строки.
     * Может быть null, если задача еще не выполнена.
     */
    result: JobWorkerResultDTO | null;
    settings: JobAnalyzerSettingsDB | null;
}

export interface Ready {
    readyJobs: Job[],
    readySummaries: AiSummary[]
}


export interface CreateJobParams {
    userId: number;
    url: string;
    type: number;
    settings: {
        depth: number;
        links: boolean;
        seo: boolean;
        lighthouse: boolean;
        lighthouse_pro: boolean;
        techstack: boolean;
        ai_summary: boolean;
    };
}

export interface AiSummary {
    jobId: number;
    userId: number;
    url: string;
    ai_summary: string;
}