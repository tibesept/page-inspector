import { z } from "zod";

// helper
export const jobAnalyzerSettings = z.object({
    depth: z.number().min(1),
    links: z.boolean(),
    seo: z.boolean(),
    lighthouse: z.boolean(),
    lighthouse_pro: z.boolean(),
    techstack: z.boolean(),
    ai_summary: z.boolean()
}).refine(data => {
    if (data.links && !data.seo) return false;
    if (data.lighthouse_pro && !data.lighthouse) return false;
    return true;
}, {
    message: "SEO_MAX (links) requires SEO_BASIC (seo) to be active, and LIGHTHOUSE_MAX (lighthouse_pro) requires LIGHTHOUSE_BASIC (lighthouse) to be active."
});


// BODY VALIDATION
export const createJobBodySchema = z.object({
    userId: z.number(),
    url: z.string().url({ message: "Неверный формат URL" }),
    type: z.number(),
    settings: jobAnalyzerSettings,
});

export const updateJobStatusBodySchema = z.object({
    status: z.string()
});

export const jobProgressStatusSchema = z.enum([
    "pending",
    "starting_browser",
    "page_loaded",
    "running_lighthouse",
    "detecting_tech",
    "checking_links",
    "generating_report",
    "generating_ai_summary",
    "ready",
    "failed",
    "sent",
    "summary_sent"
]);


export const updateJobBodySchema = z.object({
    status: z.string(),
    result: z.string(),
});

// ---- DTO (API RESPONSES) ----

export const userSchemaDTO = z.object({
    userId: z.number(),
    balance: z.number(),
});

export const postJobSchemaDTO = z.object({
    jobId: z.number(),
    userId: z.number(),
    status: z.string(),
});

export const jobReadySummary = z.object({
    jobId: z.number(),
    userId: z.number(),
    url: z.string(),
    ai_summary: z.string()
})
export const jobsReadySchemaDTO = z.object({
    readyJobs: z.array(
        z.object({
            jobId: z.number(),
        }),
    ),
    readySummaries: z.array(jobReadySummary)
})


export const jobSchemaDTO = z
    .object({
        // get FULL job
        userId: z.number(),
        jobId: z.number(),
        type: z.number().nullable(),
        url: z.string().nullable(),
        result: z.string().nullable(),
        status: z.string().nullable(),
        settings: jobAnalyzerSettings,
        ai_summary: z.string().nullable()
    })
    .nullable();

//  ---- RABBIT ----

export const jobTaskSchema = z.object({
    jobId: z.number(),
    userId: z.number(),
    url: z.string(),
    status: z.string(),
    type: z.number(),
    settings: z.string(),
});

// ----- WORKER -----
export const lighthouseAuditItemSchema = z.object({
    url: z.string(),
    wastedBytes: z.number().nullable(),
    wastedMs: z.number().nullable(),
    totalBytes: z.number().nullable(),
});

export const lighthousePremiumInsightsSchema = z.object({
    renderBlocking: z.array(lighthouseAuditItemSchema),   // ресурсы, блокирующие отрисовку
    unusedJavascript: z.array(lighthouseAuditItemSchema),  // неиспользуемый JS
    unusedCss: z.array(lighthouseAuditItemSchema),         // неиспользуемый CSS
    unoptimizedImages: z.array(lighthouseAuditItemSchema),  // неоптимизированные картинки
    mainThreadWork: z.array(z.object({                     // нагрузка на основной поток
        group: z.string(),
        duration: z.number(),
    })),
}).nullable();

export const lighthouseResultSchema = z.object({
    // Общие оценки (0-1)
    performance: z.number().nullable(),
    accessibility: z.number().nullable(),
    bestPractices: z.number().nullable(),
    seo: z.number().nullable(),

    // Core Web Vitals
    lcp: z.number().nullable(), // Largest Contentful Paint (ms)
    cls: z.number().nullable(), // Cumulative Layout Shift (score)
    tbt: z.number().nullable(), // Total Blocking Time (ms)

    // Детальные аудиты (premium)
    premiumInsights: lighthousePremiumInsightsSchema,
});
export const seoResultSchema = z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    h1: z.string().nullable(),
    linksCount: z.number().nullable(),
    internalLinks: z.number().nullable(),
    externalLinks: z.number().nullable(),
    brokenLinks: z.array(
        z.object({
            url: z.string(),
            status: z.number(),
            error: z.string().nullable(),
        }),
    ).nullable()
}).nullable()
export const jobWorkerResultSchema = z.object({
    screenshot: z.string(), // base64 строка
    status: z.number().nullable(), // HTTP-код или null
    robotsTxtExists: z.boolean().nullable(),
    seo: seoResultSchema,
    lighthouse: lighthouseResultSchema.nullable(),
    techStack: z.array(z.string()).nullable(),
});

export type JobWorkerResultDTO = z.infer<typeof jobWorkerResultSchema>;
export type JobWorkerLighthouseResult = z.infer<typeof lighthouseResultSchema>;
export type LighthouseAuditItem = z.infer<typeof lighthouseAuditItemSchema>;
export type LighthousePremiumInsights = z.infer<typeof lighthousePremiumInsightsSchema>;
export type JobWorkerSeoResult = z.infer<typeof seoResultSchema>;

// TYPES
export type CreateJobBody = z.infer<typeof createJobBodySchema>;
export type UpdateJobBody = z.infer<typeof updateJobBodySchema>;
export type UpdateJobStatusBody = z.infer<typeof updateJobStatusBodySchema>;
export type JobProgressStatus = z.infer<typeof jobProgressStatusSchema>;

export type JobsReadyDTO = z.infer<typeof jobsReadySchemaDTO>;
export type JobDTO = z.infer<typeof jobSchemaDTO>;
export type UserDTO = z.infer<typeof userSchemaDTO>;
export type CreateJobDTO = z.infer<typeof postJobSchemaDTO>;

export type JobTask = z.infer<typeof jobTaskSchema>;
export type JobAnalyzerSettingsDB = z.infer<typeof jobAnalyzerSettings>;
export type JobReadySummary = z.infer<typeof jobReadySummary>;

export const LIGHTHOUSE_PRO_COST = 10;
export const TELEGRAM_STARS_RATE = 1;

// BODY VALIDATION FOR PAYMENTS
export const createPaymentIntentBodySchema = z.object({
    userId: z.number(),
    amountCredits: z.number().positive(),
    amountStars: z.number().positive(),
});

export const confirmPaymentBodySchema = z.object({
    paymentId: z.string().uuid(),
    telegramChargeId: z.string(),
});

export const paymentIntentSchemaDTO = z.object({
    id: z.string(),
    userId: z.number(),
    amountCredits: z.number(),
    amountStars: z.number(),
    status: z.string(),
});

export type CreatePaymentIntentBody = z.infer<typeof createPaymentIntentBodySchema>;
export type ConfirmPaymentBody = z.infer<typeof confirmPaymentBodySchema>;
export type PaymentIntentDTO = z.infer<typeof paymentIntentSchemaDTO>;

// --- SERVICE CATALOG & SHOPPING CART ---
export type ProductId = 'SEO_BASIC' | 'SEO_MAX' | 'LIGHTHOUSE_BASIC' | 'LIGHTHOUSE_MAX' | 'AI_SUMMARY';

export interface ProductDetails {
  name: string;
  priceCredits: number;
  flags: Partial<{
    seo: boolean;
    links: boolean;
    lighthouse: boolean;
    lighthouse_pro: boolean;
    techstack: boolean;
    ai_summary: boolean;
  }>;
}

export const PRODUCT_DEPENDENCIES: Record<ProductId, ProductId | null> = {
  SEO_BASIC: null,
  SEO_MAX: 'SEO_BASIC',
  LIGHTHOUSE_BASIC: null,
  LIGHTHOUSE_MAX: 'LIGHTHOUSE_BASIC',
  AI_SUMMARY: null
};

export const SERVICES_CATALOG: Record<ProductId, ProductDetails> = {
  SEO_BASIC: {
    name: "Базовый SEO-анализ",
    priceCredits: 1.00,
    flags: { seo: true }
  },
  SEO_MAX: {
    name: "Продвинутый SEO-анализ (включая битые ссылки)",
    priceCredits: 5.00,
    flags: { seo: true, links: true }
  },
  LIGHTHOUSE_BASIC: {
    name: "Базовый Lighthouse-аудит",
    priceCredits: 2.00,
    flags: { lighthouse: true }
  },
  LIGHTHOUSE_MAX: {
    name: "Максимальный Lighthouse-аудит (включая PRO инсайты)",
    priceCredits: 12.00,
    flags: { lighthouse: true, lighthouse_pro: true }
  },
  AI_SUMMARY: {
    name: "Резюме от ИИ",
    priceCredits: 5.00,
    flags: { ai_summary: true }
  }
};

// --- SCHEDULED MONITORS ---
export const scheduledMonitorSchemaDTO = z.object({
    id: z.number(),
    userId: z.number(),
    url: z.string(),
    interval: z.string(),
    productIds: z.array(z.string()),
    active: z.boolean(),
    nextRunAt: z.string(),
});

export const createMonitorBodySchema = z.object({
    url: z.string().url({ message: "Неверный формат URL" }),
    interval: z.enum(["daily", "weekly"]),
    productIds: z.array(z.string())
});

export const updateMonitorBodySchema = z.object({
    active: z.boolean().optional(),
    interval: z.enum(["daily", "weekly"]).optional(),
    productIds: z.array(z.string()).optional()
});

export type ScheduledMonitorDTO = z.infer<typeof scheduledMonitorSchemaDTO>;
export type CreateMonitorBody = z.infer<typeof createMonitorBodySchema>;
export type UpdateMonitorBody = z.infer<typeof updateMonitorBodySchema>;

// --- NOTIFICATIONS ---
export const notificationSchemaDTO = z.object({
    id: z.number(),
    userId: z.number(),
    message: z.string(),
    sent: z.boolean(),
    createdAt: z.string(),
});

export type NotificationDTO = z.infer<typeof notificationSchemaDTO>;
