import express from 'express';
import { pinoHttp } from 'pino-http';

import router from './routes';
import logger from './logger';
import { config } from './config';
import errorHandler from './middlewares/errorHandler';
import { rabbitMQClient } from './rabbit';
import { NotFoundError } from './errors/notFoundError';

const app = express();
const pino = pinoHttp({ logger });

// Monkey-patch BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function () {
    return Number(this);
};

// MIDDLEWARES
app.use(express.json());
app.use(pino);

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ROUTER
app.use('/api', router);


// 404
app.use((req, res, next) => {
    next(new NotFoundError("Route not found"));
});

// ERROR HANDLER
app.use(errorHandler);

// RUN
const server = app.listen(config.port, () => {
    logger.info(`Listening port: ${config.port}`);
});

import { MonitorScheduler } from './cron/monitorScheduler';
MonitorScheduler.start(60000); // Check every minute

server.keepAliveTimeout = 65000; // 65 секунд
server.headersTimeout = 66000;

// Закрываем все соединения в случае краша
const gracefulShutdown = async (signal: string) => {
    logger.info(`\nReceived signal: ${signal}. Starting graceful shutdown.`);

    server.close(async () => {
        logger.info('HTTP server closed.');
        try {
            await rabbitMQClient.close();
            logger.info('RabbitMQ connection closed.');
            process.exit(0);
        } catch (error) {
            logger.fatal(error, 'Error during RabbitMQ shutdown:');
            process.exit(1);
        }
    });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));