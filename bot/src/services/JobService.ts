import { Bot, InputFile } from "grammy";
import { z } from "zod";
import { IAnalyzerSettings, TMyContext } from "#types/state.js";
import { logger } from "#core/logger.js";
import { IJobsRepository } from "#repositories/JobsRepository.js";
import { AiSummary, Job, Ready } from "#core/models/Job.js";
import {
    JobAnalyzerSettingsDB,
    JobWorkerLighthouseResult,
    jobWorkerResultSchema,
    JobWorkerSeoResult,
} from "#api/types.js"; // DTO для результата
import { defaultAnalyzerSettings } from "#bot/session.js";

const sanitizeHtml = (str: string) => 
            str.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               // возвращаем нужные html
               .replace(/&lt;b&gt;/gi, '<b>')
                .replace(/&lt;\/b&gt;/gi, '</b>')
                .replace(/&lt;i&gt;/gi, '<i>')
                .replace(/&lt;\/i&gt;/gi, '</i>');

/**
 * Оркестрирует процесс получения и обработки задач из источника данных.
 */
export class JobService {
    private isPolling = false;
    private timerId: NodeJS.Timeout | null = null;

    constructor(
        private readonly bot: Bot<TMyContext>,
        private readonly jobsRepository: IJobsRepository,
        private readonly pollIntervalMs: number,
    ) {}

    /**
     * Запускает цикл поллинга для получения новых задач.
     */
    public startPolling(): void {
        if (this.isPolling) {
            logger.warn("Job polling is already running.");
            return;
        }

        logger.info("Starting job polling...");
        this.isPolling = true;
        this.poll();
    }

    /**
     * Останавливает цикл поллинга.
     */
    public stopPolling(): void {
        if (!this.isPolling) {
            logger.warn("Job polling is not running.");
            return;
        }

        logger.info("Stopping job polling...");
        this.isPolling = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
        }
    }

    /**
     * Основной метод цикла, который получает и обрабатывает задачи.
     */
    private async poll(): Promise<void> {
        if (!this.isPolling) {
            return; // Выходим, если поллинг был остановлен
        }

        try {
            logger.debug("Polling for ready jobs...");
            const ready = await this.jobsRepository.findReady();
            await this.processReady(ready);
            
        } catch (error) {
            logger.error(error, "An error occurred during the polling cycle.");
        } finally {
            // Планируем следующий вызов только если сервис все еще активен
            if (this.isPolling) {
                this.timerId = setTimeout(
                    () => this.poll(),
                    this.pollIntervalMs,
                );
            }
        }
    }

    private async processReady(ready: Ready) {
        logger.debug(`Found ${ready.readyJobs.length} jobs to process.`);

        // ready jobs
        await Promise.all(ready.readyJobs.map((job) => this.processJob(job)));

        // ready summaries
        await Promise.all(ready.readySummaries.map((summary) => {
            this.processSummary(summary);
        }))

    }

    /**
     * Обрабатывает одну задачу: отправляет резюме от ИИ пользователю и обновляет статус.
     */
    private async processSummary(summary: AiSummary) {
        try {
            if(!summary.jobId || !summary.userId) {
                throw new Error(`Summary id invalid. jobId: ${summary.jobId} | userId: ${summary.jobId}`);
            }
            
            const safeUrl = summary.url.replace(/&/g, '&amp;');
            const safeSummary = sanitizeHtml(summary.ai_summary);;
            const message = `🤖 <b>Резюме от ИИ</b>\n- URL: ${safeUrl}\n\n${safeSummary}`;
            await this.bot.api.sendMessage(summary.userId, message, { parse_mode: "HTML" });
            await this.jobsRepository.updateStatus(summary.jobId, "summary_sent")

        } catch(err) {
            logger.error(err, `Failed to process summary: ${summary}.`);
            if (summary.userId) {
                await this.bot.api.sendMessage(
                    summary.userId,
                    `Возникла непредвиденная ошибка при обработке вашего запроса. Номер задачи: ${summary.jobId}`,
                );
            }
            if(summary.jobId) {
                await this.jobsRepository.updateStatus(
                    summary.jobId,
                    "failed",
                    // (error as Error).message,
                );
            }
        }
    }

    /**
     * Обрабатывает одну задачу: отправляет результат пользователю и обновляет статус.
     */
    private async processJob(job: Job): Promise<void> {
        try {
            // Валидация данных задачи
            if (!job.result) {
                throw new Error(`Job ${job.jobId} has no result data.`);
            }
            if (job.status === "failed") {
                throw new Error(`Job ${job.jobId} has a failed status.`);
            }

            // Формирование сообщения
            const messageText = this.formatResultMessage(job.result);

            // -- Отправка РЕЗУЛЬТАТОВ + ФОТО --
            await this.bot.api.sendPhoto(
                job.userId,
                new InputFile(
                    Buffer.from(job.result.screenshot, "base64"),
                    "analysis.jpeg",
                ),
                { caption: messageText, parse_mode: "HTML" },
            );

            // Отправка списка битых ссылок, если они есть
            let brokenLinksText = "";
            if (job.result.seo?.brokenLinks?.length) {
                brokenLinksText = `Найденные битые ссылки:\n${job.result.seo.brokenLinks.map((link) => `- ${link.url}`).join("\n")}`;
                await this.bot.api.sendMessage(job.userId, brokenLinksText);
            }

            let summarySent = false;
            if(job.settings?.ai_summary) {
                const msg = await this.bot.api.sendMessage(
                    job.userId,
                    "Получение резюме от ИИ...",
                )
                await this.bot.api.sendChatAction(job.userId, "typing");

                if(job.ai_summary && job.url) { // если ВДРУГ резюме УЖЕ готово.
                    await this.bot.api.deleteMessage(msg.chat.id, msg.message_id);
                    await this.processSummary({
                        jobId: job.jobId,
                        userId: job.userId,
                        url: job.url,
                        ai_summary: job.ai_summary
                    });
                    summarySent = true;
                }
            }

            if(!summarySent) {
                await this.jobsRepository.updateStatus(job.jobId, "sent");
            }
            // Пометка задачи как отправленной
            logger.info(
                `Successfully processed and sent job ${job.jobId} to user ${job.userId}.${summarySent ? ' + Summary sent!' : ''}`,
            );
        } catch (error) {
            logger.error(error, `Failed to process job ${job.jobId}.`);
            // Если произошла ошибка, уведомляем пользователя и помечаем задачу как 'failed'
            if (job.userId) {
                await this.bot.api.sendMessage(
                    job.userId,
                    `Возникла непредвиденная ошибка при обработке вашего запроса. Номер задачи: ${job.jobId}`,
                );
                await this.jobsRepository.updateStatus(
                    job.jobId,
                    "failed",
                    // (error as Error).message,
                );
            }
        }
    }

    public async createNewJob(data: {
        userId: number;
        url: string;
        analyzerSettings: IAnalyzerSettings;
    }): Promise<Job> {
        logger.info(
            `User ${data.userId} requested a new job for URL: ${data.url}`,
        );

        // TODO:
        // - Типы задач, глубина
        // - Проверка, есть ли у пользователя баланс
        // - Проверка, не создавал ли он такую же задачу 5 минут назад
        // - Списание денег (только после выполнения джобы. Если один из пунктов провалился - за него деньги не берем)

        // Объединяем настройки по умолчанию с пользовательскими, 
        // чтобы обойти проблему неполных сессий у старых пользователей
        const settings = {
            ...defaultAnalyzerSettings,
            ...data.analyzerSettings
        };

        const jobDataForRepo = {
            userId: data.userId,
            url: data.url,
            type: 1,
            settings: {
                depth: 1, // TODO: depth
                seo: settings.seo,
                lighthouse: settings.lighthouse,
                links: settings.links,
                // FIXME: хардкод, т.к. функция не реализована до конца (fix/disable-techstack-feature)
                techstack: false, // settings.techstack,
                ai_summary: settings.ai_summary,
                lighthouse_pro: settings.lighthouse_pro
            }
        }

        // Делегируем создание репозиторию
        const createdJob = await this.jobsRepository.createJob(jobDataForRepo);

        return createdJob;
    }

    public async getJobById(id: number): Promise<Job | null> {
        return this.jobsRepository.findById(id);
    }

    // FIXME: костыль
    public async updateProgressMessage(chatId: number, messageId: number, text: string): Promise<void> {
        await this.bot.api.editMessageText(chatId, messageId, text, { parse_mode: "HTML" }).catch(() => {});
    }

    public async deleteProgressMessage(chatId: number, messageId: number): Promise<void> {
        await this.bot.api.deleteMessage(chatId, messageId).catch(() => {});
    }

    /**
     * Форматирует результат анализа в HTML-сообщение.
     */
    private formatResultMessage(
        result: z.infer<typeof jobWorkerResultSchema>,
    ): string {

        // status - 200 / 404 / etc
        const statusInfo = result.status ? this.formatStatusResult(result.status) : {showLighthouse: true, text: `Неизвестно (сообщите разработчику)`};

        const seoBlock = this.formatSeoResult(result.seo ?? null);

        let lighthouseBlock = this.formatLighthouseResult(result.lighthouse ?? null);

        // lighthouse иногда не проводится при 4xx/5xx ошибках, так что уточняем для юзера
        if(lighthouseBlock.includes("не проводился") && !statusInfo.showLighthouse) {
            lighthouseBlock = `\n⚡️ <b>Производительность (Lighthouse):</b>\n - <code>Сайт недоступен (${result.status}), анализ не проводился</code>\n`;
        }

        let techStackBlock = ``;

        if (result.techStack && result.techStack.length > 0) {
            techStackBlock = `💻 <b>Стек технологий:</b>
${result.techStack.map((tech) => ` - <code>${this.escapeHtml(tech)}</code>`).join("\n")}
`;
        }

        return `
<b>Результаты анализа вашего сайта:</b>
${statusInfo.text}
${seoBlock}
🤖 <b>Файл robots.txt:</b> <code>${result.robotsTxtExists ? "✅ Существует" : "❌ Отсутствует"}</code>
${lighthouseBlock}
${techStackBlock}
 `;
    }

    private formatStatusResult(status: number): {showLighthouse: boolean, text: string} {
        let emoji = "⚠️"; // дефолт для странных штук

        if (status >= 200 && status < 300) {
            emoji = "✅";
        } else if (status >= 400 && status < 500) {
            emoji = status === 404 ? "🔍" : "🚫"; // ошибка клиента
        } else if (status >= 500) {
            emoji = "🔥"; // ошибка сервера
        } else if (status >= 300 && status < 400) {
            emoji = "🔄"; // редирект
        }

        return {
            showLighthouse: status < 400,
            text: `\n📊 <b>Статус:</b> ${emoji} <code>${status}</code>`
        };
    }

    private formatLighthouseResult(
        lighthouse: JobWorkerLighthouseResult | null,
    ): string {
        if (!lighthouse) {
            return `\n⚡️ <b>Производительность (Lighthouse):</b>\n - <code>Анализ не проводился</code>\n`;
        }
        // Хелперы для форматирования метрик
        const formatScore = (score: number | null) => {
            if (score === null) return "<code>N/A</code>";
            const percent = (score * 100).toFixed(0);
            const emoji = score >= 0.9 ? "🟢" : score >= 0.5 ? "🟡" : "🔴";
            return `${emoji} <code>${percent}%</code>`;
        };

        const formatLCP = (ms: number | null) => {
            if (ms === null) return "<code>N/A</code>";
            const seconds = (ms / 1000).toFixed(2);
            const emoji = ms <= 2500 ? "🟢" : ms <= 4000 ? "🟡" : "🔴";
            return `${emoji} <code>${seconds} с</code>`;
        };

        const formatCLS = (score: number | null) => {
            if (score === null) return "<code>N/A</code>";
            const formatted = score.toFixed(3);
            const emoji = score <= 0.1 ? "🟢" : score <= 0.25 ? "🟡" : "🔴";
            return `${emoji} <code>${formatted}</code>`;
        };

        const formatTBT = (ms: number | null) => {
            if (ms === null) return "<code>N/A</code>";
            const emoji = ms <= 200 ? "🟢" : ms <= 600 ? "🟡" : "🔴";
            return `${emoji} <code>${ms.toFixed(0)} мс</code>`;
        };

        const premiumBlock = lighthouse.premiumInsights 
            ? this.formatPremiumInsights(lighthouse.premiumInsights) 
            : "";

        return `
⚡️ <b>Производительность (Lighthouse):</b>
 - Performance: ${formatScore(lighthouse.performance)}
 - Accessibility: ${formatScore(lighthouse.accessibility)}
 - Best Practices: ${formatScore(lighthouse.bestPractices)}
 - SEO: ${formatScore(lighthouse.seo)}

📈 <b>Core Web Vitals:</b>
 - LCP (Загрузка): ${formatLCP(lighthouse.lcp)}
 - CLS (Стабильность): ${formatCLS(lighthouse.cls)}
 - TBT (Интерактивность): ${formatTBT(lighthouse.tbt)}
${premiumBlock}`;
    }

    private formatPremiumInsights(insights: NonNullable<JobWorkerLighthouseResult["premiumInsights"]>): string {
        let text = `\n💎 <b>Премиум Инсайты (Узкие места):</b>\n`;
        let hasData = false;

        const formatList = (items: { url: string; wastedBytes: number | null; wastedMs: number | null; totalBytes: number | null }[], title: string, emoji: string) => {
            if (!items || items.length === 0) return "";
            hasData = true;
            let block = `${emoji} <b>${title}:</b>\n`;
            items.slice(0, 3).forEach(item => {
                const info = [];
                if (item.wastedMs) info.push(`${item.wastedMs.toFixed(0)} мс`);
                if (item.wastedBytes) info.push(`${(item.wastedBytes / 1024).toFixed(0)} КБ`);
                
                let filename = item.url.split('/').pop()?.split('?')[0] || "ресурс";
                if (!filename || filename.length < 2) {
                    const cleanUrl = item.url.replace(/^https?:\/\//, '');
                    filename = cleanUrl.substring(0, 25) + "...";
                }
                const safeName = this.escapeHtml(filename.length > 25 ? filename.substring(0, 25) + '...' : filename);
                
                block += `  ▪️ <code>${safeName}</code> ${info.length ? `[${info.join(', ')}]` : ''}\n`;
            });
            if (items.length > 3) {
                block += `  <i>...и еще ${items.length - 3}</i>\n`;
            }
            return block;
        };

        const renderBlocking = formatList(insights.renderBlocking, "Блокируют отрисовку", "🚧");
        const unusedJs = formatList(insights.unusedJavascript, "Неиспользуемый JS", "🗑️");
        const unusedCss = formatList(insights.unusedCss, "Неиспользуемый CSS", "🎨");
        const unoptimizedImages = formatList(insights.unoptimizedImages, "Тяжелые картинки", "🖼️");

        let mainThread = "";
        if (insights.mainThreadWork && insights.mainThreadWork.length > 0) {
            hasData = true;
            mainThread = `⚙️ <b>Главный поток (Топ нагрузок):</b>\n`;
            insights.mainThreadWork.slice(0, 3).forEach(work => {
                mainThread += `  ▪️ ${this.escapeHtml(work.group)}: <code>${work.duration.toFixed(0)} мс</code>\n`;
            });
        }

        if (!hasData) {
            return `\n💎 <b>Премиум Инсайты:</b>\n - <code>Проблем не обнаружено ✨</code>\n`;
        }

        return text + [renderBlocking, unusedJs, unusedCss, unoptimizedImages, mainThread].filter(b => b.length > 0).join("\n");
    }

    private formatSeoResult(seo: JobWorkerSeoResult | null): string {
        if (!seo) {
            return `\n🔎 <b>SEO-показатели:</b>\n - <code>Анализ не проводился</code>\n`;
        }

        const title = seo.title ? this.escapeHtml(seo.title) : "❌ Не найден";
        const description = seo.description
            ? this.escapeHtml(seo.description)
            : "❌ Не найдено";
        const h1 = seo.h1 ? this.escapeHtml(seo.h1) : "❌ Не найден";
        const brokenLinks = (seo.brokenLinks?.length != null) 
            ? ` - Битых ссылок: <code>${seo.brokenLinks?.length}</code>` 
            : '';
        const externalLinks = seo.externalLinks ?? 'Анализ не проводился';
        const internalLinks = seo.internalLinks ?? 'Анализ не проводился';
        const linksCount = seo.linksCount ?? 'Анализ не проводился';

        return `
🔎 <b>SEO-показатели:</b>
 - title: <code>${title}</code>
 - description: <code>${description}</code>
 - Заголовок H1: <code>${h1}</code>

🔗 <b>Ссылки:</b>
 - Всего: <code>${linksCount}</code>
 - Внешних: <code>${externalLinks}</code>
 - Внутренних: <code>${internalLinks}</code>
${brokenLinks}
`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
