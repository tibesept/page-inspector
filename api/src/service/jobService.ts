import { Job } from "@prisma/client";
import { prisma } from "../db";
import { JobAnalyzerSettingsDB, JobReadySummary } from "../types";

import { jobProgressStatusSchema } from "../types";

export const ValidJobStatuses = jobProgressStatusSchema.options;
export class JobService {
    static async createJob(url: string, type: number, userId: number, settings: JobAnalyzerSettingsDB): Promise<Job> {
        return await prisma.job.create({
            data: {
                url,
                type,
                userId: BigInt(userId),
                settings: JSON.stringify(settings)
            },
        });
    }
    static async updateJobResult(jobId: number, result: string, status: string): Promise<Job> {
        return await prisma.job.update({
            where: {
                jobId
            },
            data: {
                result,
                status
            },
        });
    }
    static async updateJobSummary(jobId: number, ai_summary: string): Promise<Job> {
        return await prisma.job.update({
            where: {
                jobId
            },
            data: {
                ai_summary
            },
        });
    }

    static async updateJobStatus(jobId: number, status: string): Promise<Job> {
        return await prisma.job.update({
            where: {
                jobId
            },
            data: {
                status
            },
        });
    }

    static async getJobsWithSummariesUnsent(): Promise<JobReadySummary[]> {
        const jobs = await prisma.job.findMany({
            where: {
                ai_summary: {
                    not: null
                },
                status: {
                    in: ["ready", "sent"]
                }
            },
            select: {
                jobId: true,
                userId: true,
                url: true,
                ai_summary: true,
            },
        });
        return jobs.map(job => ({
            ...job,
            userId: Number(job.userId),
            ai_summary: job.ai_summary! // чтоб TS не ругался
        }));
    }

    static async getJobByStatus(status: string): Promise<{
        jobId: number;
        userId: number;
        url: string;
        status: string;
    }[]> {
        const jobs = await prisma.job.findMany({
            where: {
                status
            },
            select: {
                jobId: true,
                userId: true,
                url: true,
                status: true,
            },
        });
        return jobs.map(job => ({
            ...job,
            userId: Number(job.userId)
        }));
    }


    static async getJobById(id: number): Promise<Job | null> {
        return await prisma.job.findUnique({
            where: { jobId: id },
        });
    }
}