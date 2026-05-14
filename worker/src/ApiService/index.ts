import { _apiHttpClient } from "../HttpClient/index.js";
import { CreateJobDTO, JobProgressStatus, postJobSchemaDTO, UpdateJobBody } from "../types.js";

// Inline schema for z.any() and z.boolean() — avoids importing from "zod"
// which resolves to v3 (from lighthouse) instead of v4 (from _shared).
const anySchema = { safeParse: (data: unknown) => ({ success: true as const, data }) };
const booleanSchema = {
    safeParse: (data: unknown) => {
        if (typeof data === "boolean") return { success: true as const, data };
        return { success: false as const, error: { message: "Expected boolean" } };
    }
};

type HttpClient = typeof _apiHttpClient;

class ApiService {
    constructor(private readonly client: HttpClient) {}

    // JOBS
    public updateJobTask(
        id: number,
        body: UpdateJobBody,
    ): Promise<CreateJobDTO> {
        return this.client.put(`/jobs/${id}`, body, postJobSchemaDTO);
    }

    public updateJobStatus(
        id: number,
        status: JobProgressStatus,
    ): Promise<any> {
        // Облегченный запрос только для обновления статуса
        return this.client.put(`/jobs/${id}/status`, { status }, anySchema);
    }

    public doJobExist(id: number): Promise<boolean> {
        return this.client.get(`/jobs/check/${id}`, booleanSchema);
    }
}

/**
 * Единственный экземпляр ApiService, который используется ботом
 * он создается с единственным экземпляром http клиента.
 */
export const apiService = new ApiService(_apiHttpClient);
