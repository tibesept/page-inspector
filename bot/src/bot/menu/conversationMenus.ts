import { IAnalyzerSettings, TMyContext } from "#types/state.js";
import { jobProgressStatusSchema, JobProgressStatus } from "#api/types.js";
import { Conversation, ConversationMenu } from "@grammyjs/conversations";
import { Context } from "grammy";
import { getSettingsText, settingToggles } from "./helpers.js";
import Emoji from "#bot/emoji.js";
import { logger } from "#core/logger.js";
import { LIGHTHOUSE_PRO_COST } from "@page-inspector/shared";

// ----- PRE JOB SETTINGS ---- 
export function createSettingsMenu(
    conversation: Conversation<Context, TMyContext>,
    settingsBuffer: IAnalyzerSettings,
    parent: ConversationMenu<TMyContext>
) {
    return conversation
        .menu("settings-menu", { parent: parent, autoAnswer: false })
        .dynamic((ctx, range) => {
            settingToggles.forEach((toggle) => { // создаем чекбоксы (toggles)
                range.text(
                    () => `${toggle.label}: ${settingsBuffer[toggle.key] ? Emoji.yes : Emoji.no}`, // текст чекбокса
                    async (ctx) => { // логика нажатия на чекбокс
                        if (!settingsBuffer[toggle.key]) {
                            if (toggle.key === "lighthouse_pro") {
                                // get user (кешируется во время реплеев диалога)
                                const user = await conversation.external(() =>
                                    ctx.userService.getUserById(ctx.from!.id)
                                );

                                if (!user || user.balance < LIGHTHOUSE_PRO_COST) {
                                    try {
                                        await ctx.answerCallbackQuery({
                                            text: `❌ Недостаточно кредитов!\n\nТребуется: ${LIGHTHOUSE_PRO_COST}\nУ вас: ${user?.balance || 0}`,
                                            show_alert: true
                                        });
                                    } catch (e) {
                                        logger.error(e, "Не успели показать алерт из-за долгого ответа API");
                                    }
                                    return; // Прерываем включение чекбокса
                                }
                            }
                        }

                        // если настройка включается и у нее есть зависимая настройка, то включаем зависимую. 
                        if (toggle.parent && !settingsBuffer[toggle.key]) {
                            settingsBuffer[toggle.parent] = true;
                        }
                        // если настройка выключается и у нее есть опциональная поднастройка, то ее тоже выключаем 
                        if (toggle.child && settingsBuffer[toggle.key]) {
                            settingsBuffer[toggle.child] = false;
                        }

                        settingsBuffer[toggle.key] = !settingsBuffer[toggle.key];
                        ctx.menu.update();
                    },
                );
                range.row();
            });
        })
        .row()
        .back("Применить", async (ctx) => { // кнопка "Применить". Сохраняет изменеиня
            await conversation.external(async (ctx: TMyContext) => {
                ctx.session.analyzerSettings = { ...settingsBuffer };
            });
            await ctx.editMessageText(getSettingsText(settingsBuffer), {
                parse_mode: "HTML",
            });
        })
        .back("Отмена", async (ctx) => { // кнопка "Отмена". Откатывает изменения
            const originalSettings = await conversation.external(
                (ctx: TMyContext) => ctx.session.analyzerSettings
            );
            settingToggles.forEach((toggle) => {
                settingsBuffer[toggle.key] = originalSettings[toggle.key];
            });
        });
}

// ----- PRE JOB MENU ---- 
export function createMainMenu(
    conversation: Conversation<Context, TMyContext>,
    url: string,
    settingsBuffer: IAnalyzerSettings
) {
    const main = conversation.menu("root-menu")
        .text("🚀 Запуск!", async (ctx) => {
            await ctx.deleteMessage();
            const progressMsg = await ctx.reply("⏳ <b>Ожидайте...</b>", { parse_mode: "HTML" });

            const job = await conversation.external((ctx: TMyContext) => {
                if (!ctx.from?.id) throw new Error("No ctx.from.id");

                return ctx.jobService.createNewJob({
                    userId: ctx.from.id,
                    url: url,
                    analyzerSettings: settingsBuffer,
                }).catch((err) => {
                    ctx.reply("Что-то пошло не так.");
                    logger.error(err, "error creating new job");
                    return null;
                });
            });

            if (job) {
                // Запускаем асинхронный пуллинг статуса без блокировки бота
                const pollJob = async () => {
                    const PROGRESS_MAP: Partial<Record<JobProgressStatus | "created", string>> = {
                        "pending": "⏳ <b>В очереди...</b>",
                        "created": "⏳ <b>В очереди...</b>", // На случай старых записей
                        "starting_browser": "🖥 <b>Запуск браузера...</b>",
                        "page_loaded": "✅ <b>Страница загружена</b>",
                        "running_lighthouse": "🔥 <b>Lighthouse анализирует метрики...</b>",
                        "detecting_tech": "💻 <b>Определение стека технологий...</b>",
                        "checking_links": "🔗 <b>Проверка ссылок...</b>",
                        "generating_report": "🤖 <b>Формирование отчета...</b>",
                        "generating_ai_summary": "🧠 <b>Нейросеть пишет резюме...</b>",
                        "ready": "✨ <b>Отчет готов! Отправляем...</b>",
                        "failed": "❌ <b>Ошибка при выполнении анализа</b>",
                        "sent": "✨ <b>Отчет отправлен!</b>",
                        "summary_sent": "✨ <b>Отчет отправлен!</b>"
                    };

                    let lastStatus = "";
                    let isPolling = true;

                    while (isPolling) {
                        try {
                            const currentJob = await ctx.jobService.getJobById(job.jobId);
                            if (!currentJob) {
                                isPolling = false;
                                break;
                            }

                            if (currentJob.status !== lastStatus) {
                                lastStatus = currentJob.status;

                                let text = `🔄 <b>Статус: ${currentJob.status}</b>`;
                                const parsedStatus = jobProgressStatusSchema.safeParse(currentJob.status);
                                if (parsedStatus.success) {
                                    text = PROGRESS_MAP[parsedStatus.data] || text;
                                } else if (currentJob.status === "created") {
                                    text = PROGRESS_MAP["created"] || text;
                                }

                                await ctx.jobService.updateProgressMessage(progressMsg.chat.id, progressMsg.message_id, text);
                            }

                            if (["ready", "failed", "sent", "summary_sent"].includes(currentJob.status)) {
                                isPolling = false;
                                if (["ready", "sent", "summary_sent"].includes(currentJob.status)) {
                                    await ctx.jobService.deleteProgressMessage(progressMsg.chat.id, progressMsg.message_id);
                                }
                            }
                        } catch (e) {
                            logger.error(e, "Error in job polling loop, will retry");
                            // Не останавливаем пуллинг при временных ошибках сети/API
                        }

                        if (isPolling) {
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        }
                    }
                };

                pollJob();
            }

            conversation.halt() // выходим из conversation
        });

    const settings = createSettingsMenu(conversation, settingsBuffer, main);

    main.submenu("✏️ Изменить", settings);
    main.row().text("❌Отмена", async (ctx) => {
        await ctx.deleteMessage();
        await ctx.reply("Операция отменена!");
        conversation.halt()
    })
    return main;
}

// ----- BUY CREDITS MENU -----
export function createBuyCreditsMenu(
    conversation: Conversation<Context, TMyContext>
) {
    const menu = conversation.menu("buy-credits-menu")
        .text("❌ Отмена", async (ctx) => {
            await ctx.deleteMessage();
            await ctx.reply("Операция отменена!");
            conversation.halt();
        });
    return menu;
}