// RabbitMQClient.ts
import amqp, { Channel, ConsumeMessage, ChannelModel } from "amqplib";
import logger from "./logger";
import {
    RabbitMQConnectionError,
    RabbitMQPublishError,
    RabbitMQCloseError,
} from "./errors/rabbitMq";
import { JobTask } from "./types";
import { config } from "./config";

class RabbitMQClient {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    private connectionPromise: Promise<Channel> | null = null;

    constructor(
        private readonly url: string,
        private readonly queueName: string
    ) {}

    /**
     * Устанавливает соединение и создаёт канал.
     */
    private connect(): Promise<Channel> {
        if (this.channel) {
            return Promise.resolve(this.channel);
        }
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = (async () => {
            try {
                logger.info("Connecting to RabbitMQ...");
                this.connection = await amqp.connect(this.url);

                this.setupConnectionListeners();

                const channel = await this.connection.createChannel();
                await channel.assertQueue(this.queueName, { durable: true });

                this.channel = channel;
                logger.info("RabbitMQ connected, channel ready.");

                this.connectionPromise = null;
                return channel;
            } catch (err) {
                this.resetConnection();
                logger.error({ err }, "RabbitMQ connection failed");
                throw new RabbitMQConnectionError(err instanceof Error ? err : undefined);
            }
        })();

        return this.connectionPromise;
    }

    private setupConnectionListeners(): void {
        if (!this.connection) return;

        this.connection.on("close", () => {
            logger.warn("RabbitMQ connection closed.");
            this.resetConnection();
        });

        this.connection.on("error", (err) => {
            logger.error({ err }, "RabbitMQ connection error");
            // После ошибки соединение всё равно закроется через reset в 'closez
        });
    }

    private resetConnection(): void {
        this.connection = null;
        this.channel = null;
        this.connectionPromise = null;
    }

    /**
     * Отправка задачи в очередь (используется в API).
     */
    public async sendTask(task: JobTask): Promise<void> {
        try {
            const channel = await this.connect();
            const message = Buffer.from(JSON.stringify(task));

            channel.sendToQueue(this.queueName, message, { persistent: true });
            logger.info({ task }, `Task sent to queue "${this.queueName}"`);
        } catch (err) {
            logger.error({ err, task }, "Failed to send task");
            throw new RabbitMQPublishError(task, err instanceof Error ? err : undefined);
        }
    }

    /**
     * Подписка на задачи (используется в воркере).
     */
    public async consume(
        onMessage: (msg: ConsumeMessage) => Promise<void>,
        options: { prefetch?: number } = {}
    ): Promise<void> {
        const channel = await this.connect();

        if (options.prefetch) {
            channel.prefetch(options.prefetch);
        }

        await channel.consume(
            this.queueName,
            async (msg) => {
                if (!msg) return;
                try {
                    await onMessage(msg);
                    channel.ack(msg);
                } catch (err) {
                    logger.error({ err }, "Error processing message");
                    // можно nack → повтор или drop
                    channel.nack(msg, false, false);
                }
            },
            { noAck: false }
        );

        logger.info(`Subscribed to queue "${this.queueName}"`);
    }

    /**
     * Закрыть соединение.
     */
    public async close(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
            }
            if (this.connection) {
                await this.connection.close();
            }
            this.resetConnection();
            logger.info("RabbitMQ connection closed gracefully");
        } catch (err) {
            logger.error({ err }, "Error closing RabbitMQ connection");
            throw new RabbitMQCloseError(err instanceof Error ? err : undefined);
        }
    }
}

export const rabbitMQClient = new RabbitMQClient(config.rabbit_url, config.rabbit_queue_name);
