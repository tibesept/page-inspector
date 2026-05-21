import { ApiHttpClient } from "#api/HttpClient.js";
import { z } from "zod";
import {
    CreateJobBody,
    createJobBodySchema,
    CreateJobDTO,
    JobDTO,
    jobSchemaDTO,
    JobsReadyDTO,
    jobsReadySchemaDTO,
    postJobSchemaDTO,
    UpdateJobStatusBody,
    updateJobStatusBodySchema,
    UserDTO,
    userSchemaDTO,
    CreatePaymentIntentBody,
    createPaymentIntentBodySchema,
    ConfirmPaymentBody,
    confirmPaymentBodySchema,
    PaymentIntentDTO,
    paymentIntentSchemaDTO,
} from "#api/types.js";


/**
 * Позволяет удобно отправлять HTTP запросы в API
 */


export class ApiService {
    constructor(private readonly client: ApiHttpClient) {}

    // JOBS
    public getJobsDone(): Promise<JobsReadyDTO> {
        return this.client.get(`/jobs/ready`, jobsReadySchemaDTO);
    }

    public getJob(id: number): Promise<JobDTO> {
        return this.client.get(`/jobs/${id}`, jobSchemaDTO);
    }

    public createJob(body: CreateJobBody): Promise<CreateJobDTO> {
        createJobBodySchema.parse(body); // валидация body
        return this.client.post("/jobs", body, postJobSchemaDTO);
    }

    public updateJobStatus(id: number, status: string): Promise<CreateJobDTO> {
        const body: UpdateJobStatusBody = updateJobStatusBodySchema.parse({
            status: status
        });
        return this.client.put(`/jobs/status/${id}`, body, postJobSchemaDTO);
    }


    // USER
    public getUserById(id: number): Promise<UserDTO> {
        return this.client.get(`/users/${id}`, userSchemaDTO);
    }

    // PAYMENTS
    public createPaymentIntent(body: CreatePaymentIntentBody): Promise<PaymentIntentDTO> {
        createPaymentIntentBodySchema.parse(body);
        return this.client.post("/payments", body, paymentIntentSchemaDTO);
    }

    public confirmPayment(body: ConfirmPaymentBody): Promise<{ success: boolean; alreadyProcessed: boolean }> {
        confirmPaymentBodySchema.parse(body);
        const confirmPaymentResponseSchema = z.object({
            success: z.boolean(),
            alreadyProcessed: z.boolean(),
        });
        return this.client.post("/payments/confirm", body, confirmPaymentResponseSchema);
    }
}