import { z } from "zod";
export * from "@page-inspector/shared";

// --- CART DTOS ---
export const cartItemSchemaDTO = z.object({
    productId: z.string(),
    name: z.string(),
    price: z.string(),
});

export const cartSchemaDTO = z.object({
    items: z.array(cartItemSchemaDTO),
    totalCost: z.string(),
});

export const checkoutResponseSchemaDTO = z.object({
    success: z.boolean(),
    job: z.object({
        jobId: z.number(),
        userId: z.number(),
        status: z.string(),
        url: z.string(),
    }),
});

export type CartItemDTO = z.infer<typeof cartItemSchemaDTO>;
export type CartDTO = z.infer<typeof cartSchemaDTO>;
export type CheckoutResponseDTO = z.infer<typeof checkoutResponseSchemaDTO>;


