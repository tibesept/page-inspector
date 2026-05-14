import { _apiHttpClient } from "../HttpClient/index.js";
import { CreateJobDTO, JobProgressStatus, postJobSchemaDTO, UpdateJobBody } from "../types.js";
import { z } from "zod";


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
        return this.client.put(`/jobs/${id}/status`, { status }, z.any());
    }

    public doJobExist(id: number): Promise<Boolean> {
        return this.client.get(`/jobs/check/${id}`, z.boolean());
    }
}

/**
 * Единственный экземпляр ApiService, который используется ботом
 * он создается с единственным экземпляром http клиента.
 */
export const apiService = new ApiService(_apiHttpClient);
