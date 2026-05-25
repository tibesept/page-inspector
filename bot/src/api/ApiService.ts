import { ApiHttpClient } from "#api/HttpClient.js";
import { z } from "zod";
import {
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
    cartSchemaDTO,
    CartDTO,
    ProductId,
    checkoutResponseSchemaDTO,
    CheckoutResponseDTO,
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

    // CART
    public getCart(userId: number | bigint): Promise<CartDTO> {
        return this.client.get(`/cart/${userId}`, cartSchemaDTO);
    }

    public addToCart(userId: number | bigint, productId: ProductId): Promise<any> {
        return this.client.post(`/cart/${userId}/add`, { productId }, z.any());
    }

    public removeFromCart(userId: number | bigint, productId: ProductId): Promise<any> {
        return this.client.delete(`/cart/${userId}/remove/${productId}`, z.any());
    }

    public checkoutCart(userId: number | bigint, url: string): Promise<CheckoutResponseDTO> {
        return this.client.post(`/cart/${userId}/checkout`, { url }, checkoutResponseSchemaDTO);
    }
}