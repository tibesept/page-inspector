import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

// Core
import { config } from '#core/config.js';
import { logger } from '#core/logger.js';

// Layers
import { ApiHttpClient } from '#api/HttpClient.js';
import { ApiService } from '#api/ApiService.js';
import { JobsRepository } from '#repositories/JobsRepository.js';
import { JobService } from '#services/JobService.js';
import { configureBot } from '#bot/bot.js';
import { App } from './app.js';
import { Bot } from 'grammy';
import { TMyContext } from '#types/state.js';
import { UsersRepository } from '#repositories/UsersRepository.js';
import { UserService } from '#services/UserService.js';
import { MonitorService } from '#services/MonitorService.js';
import { NotificationService } from '#services/NotificationService.js';

const bootstrap = async () => {
    logger.info("Starting application bootstrap...");
    const bot = new Bot<TMyContext>(config.telegram.token);

    // api
    const httpClient = new ApiHttpClient(config.api);
    const apiService = new ApiService(httpClient);
    
    
    // jobs
    const jobsRepository = new JobsRepository(apiService);
    const jobService = new JobService(bot, jobsRepository, config.api.polling_interval_ms);


    // users
    const usersRepository = new UsersRepository(apiService);
    const userService = new UserService(usersRepository);

    // monitors
    const monitorService = new MonitorService(apiService);

    // notifications
    const notificationService = new NotificationService(bot, apiService, 30000); // 30 seconds

    configureBot(bot, usersRepository, userService, jobService, monitorService);

    const app = new App(bot, jobService);

    notificationService.startPolling();
    
    await app.start();
};

bootstrap();