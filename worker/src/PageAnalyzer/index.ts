import puppeteer from "puppeteer-core";
import lighthouse from "lighthouse";
import { Flags } from "lighthouse";

import logger from "../logger.js";
import { config } from "../config.js";

import {
    JobWorkerLighthouseResult,
    LighthouseAuditItem,
    LighthousePremiumInsights,
    jobAnalyzerSettings,
    JobProgressStatus
} from "../types.js";
import { TECH_RULES } from "./techRules.js";
import { ProcessJobError } from "../errors/jobError.js";

const RETRY_COUNT = 2; // Количество повторных попыток
const RETRY_DELAY = 3000; // Начальная задержка в мс
const USER_AGENT =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1";

export interface SeoData {
    title: string | null;
    description: string | null;
    h1: string | null;
    linksCount: number;
    internalLinks: number;
    externalLinks: number;
}


export interface IBrokenLink {
    url: string,
    status: number,
    error: string | null
}
export interface PageAnalysisResult {
    response: puppeteer.HTTPResponse | null;
    image: Buffer;
    seoData: SeoData | null;
    robotsTxt: string | null;
    brokenLinks: IBrokenLink[] | null;
    lighthouse: JobWorkerLighthouseResult | null;
    techStack: string[] | null;
}

export interface IAnalyzerSettings {
    depth: number;
    links: boolean;
    seo: boolean;
    lighthouse: boolean;
    lighthouse_pro: boolean;
    techstack: boolean;
}



export default class PageAnalyzer {
    private readonly type;
    private readonly settings: IAnalyzerSettings;

    constructor(type: number, settingsString: string) {
        this.type = type; // Тип задачи. Платная/бесплатная
        
        const settings = jobAnalyzerSettings.parse(JSON.parse(settingsString)) // парсим
        
        this.settings = { // меппим. Чтоб наверняка
            depth: settings.depth,
            links: settings.links,
            seo: settings.seo,
            lighthouse: settings.lighthouse,
            lighthouse_pro: settings.lighthouse_pro,
            techstack: settings.techstack
        }
    }

    async analyze(url: string, onProgress?: (status: JobProgressStatus) => void) {
        return this.parsePage(url, onProgress);
    }

    async parsePage(url: string, onProgress?: (status: JobProgressStatus) => void): Promise<PageAnalysisResult> {
        onProgress?.("starting_browser");
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: config.chrome_executable_path,
            args: config.args,
        });

        logger.debug("Browser setup");

        // --- LIGHTHOUSE ---
        let lighthouseResult: JobWorkerLighthouseResult | null = null;
        if(this.settings.lighthouse) {
            try {
                onProgress?.("running_lighthouse");
                logger.debug("Running Lighthouse...");
                lighthouseResult = await this.runLightHouse(url, browser);
                logger.info(lighthouseResult, "Lighthouse analysis complete");
            } catch (err) {
                logger.error(err, "Lighthouse run failed");
                // Не прерываем выполнение, просто логгируем ошибку
            }
        }

        // --- PUPPETEER SETUP ---
        try {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setViewport({
            width: 720,
            height: 1280,
            isMobile: true,
        });

        logger.debug("Going to page");
        const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
        });

        onProgress?.("page_loaded");
        logger.debug("Evaluate");

        // --- SEO DATA ---
        let seoData: SeoData | null = null;
        if(this.settings.seo) {
            seoData = await page.evaluate((): SeoData  => {
                const title = document.title || null;
                const description =
                    document
                        .querySelector("meta[name='description']")
                        ?.getAttribute("content") || null;
                const h1 = document.querySelector("h1")?.innerText || null;
    
                const links = Array.from(document.querySelectorAll("a"))
                    .map((a) => (a as HTMLAnchorElement).href)
                    .filter(Boolean);
    
                return {
                    title,
                    description,
                    h1,
                    linksCount: links.length,
                    internalLinks: links.filter((l) =>
                        l.includes(location.hostname),
                    ).length,
                    externalLinks: links.filter(
                        (l) => !l.includes(location.hostname),
                    ).length,
                };
            });
        }

        // --- ROBOTS TXT ---
        logger.debug("Robots.txt check");
        let robotsTxt: string | null = null;
        try {
            const robotsUrl = new URL("/robots.txt", url).toString();
            const res = await fetch(robotsUrl, {});
            if (res.ok) {
                robotsTxt = await res.text();
            }
        } catch {
            logger.warn("Robots.txt not accessible");
        }

        // --- TECH STACK ---
        let techStack: string[] | null = null;
        if(this.settings.techstack) {
            try {
                onProgress?.("detecting_tech");
                logger.debug("Detecting tech stack...");
                // Передаем все три источника данных
                techStack = await this.detectTechStack(page, response, robotsTxt);
                logger.info(techStack, "Tech stack detected");
            } catch (err) {
                logger.error(err, "Tech stack detection failed");
            }
        }

        // --- SCREENSHOT ---
        logger.debug("Screenshotting");
        const image = await page.screenshot({
            type: "jpeg",
            quality: 20,
            omitBackground: true, // делает фон прозрачным (если страница не задает цвет фона)
        });


        // --- BROKEN LINKS ---
        const brokenLinks: IBrokenLink[] = [];
        if(this.settings.links) {
            onProgress?.("checking_links");
            const links = await page.$$eval("a, area", (anchors) =>
                anchors.map((anchor) => anchor.href),
            );
    
            const CONCURRENCY_LIMIT = 10; // Лимит одновременных запросов
            const CHUNK_DELAY = 1000; // Задержка между пачками
    
            const linksToCheck = [...new Set(links)];
            logger.info(`Unique links found: ${linksToCheck.length}`);
            // Обрабатываем ссылки пачками
            for (let i = 0; i < linksToCheck.length; i += CONCURRENCY_LIMIT) {
                const chunk = linksToCheck.slice(i, i + CONCURRENCY_LIMIT);

                logger.info(`Checking chunk ${Math.floor(i / CONCURRENCY_LIMIT) + 1}...`);

                const promises = chunk.map(link => this.checkLinkBroken(link));
                const chunkResults = await Promise.all(promises);

                brokenLinks.push(...chunkResults.filter((result): result is IBrokenLink => result !== null));

                // Делаем паузу перед следующей пачкой
                if (i + CONCURRENCY_LIMIT < linksToCheck.length) {
                    await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
                }
            }
            logger.info("All links checked.");
        }

        logger.debug("Closing browser");
        await browser.close();

        return {
            response,
            image: Buffer.from(image),
            seoData,
            robotsTxt,
            brokenLinks: this.settings.links ? brokenLinks : null,
            lighthouse: lighthouseResult,
            techStack: techStack,
        };

        } catch (err) {
            logger.error(err, `Failed to parse page: ${url}`);
            throw new ProcessJobError(err as Error);
        } finally {
            logger.debug("Closing browser");
            if (browser) {
                await browser.close().catch(e => logger.error(e, "Error while closing browser"));
            }
        }
    }



    private async runLightHouse(
        url: string,
        browser: puppeteer.Browser,
    ): Promise<JobWorkerLighthouseResult | null> {
        const LH_MAX_RETRIES = 2;

        // Получаем порт из WebSocket-адреса браузера
        const port = new URL(browser.wsEndpoint()).port;

        const options: Flags = {
            port: +port, // порт должен быть числом!!
            output: "json",
            onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
            logLevel: "info",
            
            // математическая модель
            throttlingMethod: "simulate", 

            // даем тяжелым страницам больше времени на загрузку (по умолчанию ~10с)
            maxWaitForLoad: 25000,

            screenEmulation: {
                mobile: true,
                width: 390, 
                height: 844,
                deviceScaleFactor: 2,
            },

            throttling: {
                rttMs: 30, // пинг типичного 4G
                throughputKbps: 15 * 1024, // 15 мбит/с
                
                // 2.5x - современный бюджетник
                cpuSlowdownMultiplier: 2.5, 
                
                // эти параметры нужны только для devtools троттлинга, но 
                // lighthouse просит их оставлять для совместимости
                requestLatencyMs: 0,
                downloadThroughputKbps: 0,
                uploadThroughputKbps: 0,
            },
        };

        for (let attempt = 1; attempt <= LH_MAX_RETRIES; attempt++) {
            const runnerResult = await lighthouse(url, options);

            if (!runnerResult?.lhr) {
                logger.warn(`Lighthouse attempt ${attempt}/${LH_MAX_RETRIES}: no LHR returned`);
                continue;
            }

            const lhr = runnerResult.lhr;

            // логируем runtimeError, если Lighthouse объясняет причину провала
            if (lhr.runtimeError) {
                logger.warn(
                    { code: lhr.runtimeError.code, message: lhr.runtimeError.message },
                    `Lighthouse attempt ${attempt}/${LH_MAX_RETRIES}: runtime error`
                );

                // страница вернула ошибку - ретраить бесполезно, результат не изменится
                if (lhr.runtimeError.code === "ERRORED_DOCUMENT_REQUEST") {
                    logger.warn("Page returned an HTTP error. Skipping Lighthouse.");
                    return null;
                }
            }

            // --- извлекаем детальные аудиты (premiumInsights) ---
            const premiumInsights = this.settings.lighthouse_pro 
                ? this.extractPremiumInsights(lhr)
                : null;

            const result: JobWorkerLighthouseResult = {
                performance: lhr.categories.performance.score,
                accessibility: lhr.categories.accessibility.score,
                bestPractices: lhr.categories["best-practices"].score,
                seo: lhr.categories.seo.score,

                lcp: lhr.audits["largest-contentful-paint"]?.numericValue ?? null,
                cls: lhr.audits["cumulative-layout-shift"]?.numericValue ?? null,
                tbt: lhr.audits["total-blocking-time"]?.numericValue ?? null,

                premiumInsights,
            };

            // Проверяем, не пустые ли все результаты
            const allNull = result.performance === null
                && result.accessibility === null
                && result.bestPractices === null
                && result.seo === null;

            if (allNull && attempt < LH_MAX_RETRIES) {
                logger.warn(`Lighthouse attempt ${attempt}/${LH_MAX_RETRIES}: all scores null, retrying...`);
                continue;
            }

            return result;
        }

        logger.error("Lighthouse: all attempts exhausted, returning null");
        return null;
    }

    /**
     * Извлекает детальные аудиты из Lighthouse для premium-отчетов.
     * Парсит конкретные ресурсы, которые тормозят сайт.
     */
    private extractPremiumInsights(lhr: any): LighthousePremiumInsights {
        try {
            // хелпер: извлечь items из аудита в формате LighthouseAuditItem[]
            const extractItems = (auditId: string): LighthouseAuditItem[] => {
                const audit = lhr.audits[auditId];
                if (!audit?.details?.items) return [];

                return audit.details.items
                    .filter((item: any) => item.url)
                    .map((item: any): LighthouseAuditItem => ({
                        url: item.url,
                        wastedBytes: item.wastedBytes ?? item.totalBytes ?? null,
                        wastedMs: item.wastedMs ?? null,
                        totalBytes: item.totalBytes ?? null,
                    }));
            };

            // нагрузка на main thread (другой формат — group + duration)
            const mainThreadItems = lhr.audits["mainthread-work-breakdown"]?.details?.items ?? [];
            const mainThreadWork = mainThreadItems
                .filter((item: any) => item.group && item.duration > 0)
                .map((item: any) => ({
                    group: item.group as string,
                    duration: Math.round(item.duration as number),
                }));

            const insights: LighthousePremiumInsights = {
                renderBlocking: extractItems("render-blocking-resources"),
                unusedJavascript: extractItems("unused-javascript"),
                unusedCss: extractItems("unused-css-rules"),
                unoptimizedImages: [
                    ...extractItems("uses-optimized-images"),
                    ...extractItems("uses-responsive-images"),
                    ...extractItems("modern-image-formats"),
                ],
                mainThreadWork,
            };

            logger.info({
                renderBlocking: insights.renderBlocking.length,
                unusedJs: insights.unusedJavascript.length,
                unusedCss: insights.unusedCss.length,
                unoptimizedImages: insights.unoptimizedImages.length,
                mainThreadGroups: insights.mainThreadWork.length,
            }, "Premium insights extracted");

            return insights;
        } catch (err) {
            logger.error({ err }, "Failed to extract premium insights");
            return null;
        }
    }

    private async detectTechStack(
        page: puppeteer.Page,
        response: puppeteer.HTTPResponse | null,
        robotsTxt: string | null,
    ): Promise<string[]> {
        const detected: Set<string> = new Set();
        const headers = response ? response.headers() : {};

        // получаем все источники данных из DOM за один вызов
        const dataSources = await page.evaluate(() => {
            const scripts = Array.from(document.scripts)
                .map((s) => s.src)
                .filter(Boolean);

            const meta = Array.from(
                document.querySelectorAll<HTMLMetaElement>("meta[name]"),
            ).reduce(
                (acc, m) => {
                    if (m.name && m.content) {
                        acc[m.name.toLowerCase()] = m.content;
                    }
                    return acc;
                },
                {} as { [name: string]: string },
            );

            const windowProps = Object.keys(window);
            const html = document.documentElement.outerHTML;

            return { scripts, meta, windowProps, html };
        });

        // прогоняем собранные данные по нашим правилам
        for (const rule of TECH_RULES) {
        if (detected.has(rule.name)) continue;

            // проверка заголовков
            if (rule.headers) {
                for (const headerName in rule.headers) {
                    const headerValue = headers[headerName.toLowerCase()];
                    if (
                        headerValue &&
                        rule.headers[headerName].test(headerValue)
                    ) {
                        detected.add(rule.name);
                        break;
                    }
                }
            }

            // скрипты
            if (rule.scripts) {
                for (const scriptSrc of dataSources.scripts) {
                    if (rule.scripts.some((r) => r.test(scriptSrc))) {
                        detected.add(rule.name);
                        break;
                    }
                }
            }

            // тег meta
            if (rule.meta) {
                for (const metaName in rule.meta) {
                    const metaValue = dataSources.meta[metaName];
                    if (metaValue && rule.meta[metaName].test(metaValue)) {
                        detected.add(rule.name);
                        break;
                    }
                }
            }

            // window
            if (rule.window) {
                if (
                    rule.window.some((prop) =>
                        dataSources.windowProps.includes(prop),
                    )
                ) {
                    detected.add(rule.name);
                }
            }

            // html
            if (rule.html) {
                if (rule.html.some((r) => r.test(dataSources.html))) {
                    detected.add(rule.name);
                }
            }

            // robots.txt
            if (rule.robots && robotsTxt) {
                if (rule.robots.some((r) => r.test(robotsTxt))) {
                    detected.add(rule.name);
                }
            }
        }

        return Array.from(detected);
    }


    async checkLinkBroken(
        url: string,
        retriesLeft = RETRY_COUNT,
    ): Promise<IBrokenLink | null> {
        // Пропускаем не-HTTP ссылки
        const nonHttpProtocolsRegex =
            /^(#|javascript:|mailto:|tel:|sms:|fax:|file:|data:|blob:)/;
        if (!url || nonHttpProtocolsRegex.test(url)) {
            return null;
        }

        let wasGetRequest = false;

        try {
            // Сначала пытаемся сделать HEAD запрос
            let response = await fetch(url, {
                method: "HEAD",
                signal: AbortSignal.timeout(8000),
                headers: { "User-Agent": USER_AGENT },
                redirect: "follow", // fetch следует за редиректами по умолчанию
            });

            // Если HEAD заблокирован (403/405), пробуем GET
            if (response.status === 403 || response.status === 405) {
                logger.debug(
                    `HEAD failed for ${url} with status ${response.status}. Retrying with GET.`,
                );
                response = await fetch(url, {
                    method: "GET",
                    signal: AbortSignal.timeout(10000),
                    headers: { "User-Agent": USER_AGENT },
                });
                wasGetRequest = true;
            }

            // Проверяем статус ответа
            if (response.status >= 400 && response.status !== 418) {
                // Если это ошибка, которую стоит повторить (серверная или rate limit)
                if (
                    (response.status === 429 || response.status >= 500) &&
                    retriesLeft > 0
                ) {
                    logger.warn(
                        `Retrying broken link check: ${url} after status ${response.status}. Retries left: ${retriesLeft}`,
                    );
                    // Ждем и рекурсивно вызываем функцию
                    await new Promise((resolve) =>
                        setTimeout(resolve, RETRY_DELAY),
                    );
                    return this.checkLinkBroken(url, retriesLeft - 1);
                }
                // Если это битая ссылка
                return { url, status: response.status, error: null };
            }

            if (wasGetRequest) {
                // soft 404
                const body = await response.text();
                if (
                    /<title>.*(404|not found|не найдена).*<\/title>/i.test(body)
                ) {
                    logger.warn(`Soft 404 detected on ${url}`);
                    return { url, status: 200, error: "Soft 404 Detected" };
                }
            }

            // Если все хорошо
            return null;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "unknown";

            // Если ошибка связана с сетью и есть попытки, пробуем снова
            if (retriesLeft > 0) {
                logger.warn(
                    `Retrying ${url} after network error: ${errorMessage}. Retries left: ${retriesLeft}`,
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, RETRY_DELAY),
                );
                return this.checkLinkBroken(url, retriesLeft - 1);
            }

            // Если попытки кончились, считаем ссылку битой
            return { url, status: -1, error: errorMessage };
        }
    }
}
