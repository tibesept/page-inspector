import amqp, { Channel, ConsumeMessage, ChannelModel } from "amqplib";
import logger from "./logger.js";
import {
    RabbitMQConnectionError,
    RabbitMQCloseError,
} from "./errors/rabbitMq.js";
import { JobTask } from "./types.js";
import { config } from "./config.js";

class RabbitMQClient {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    private connectionPromise: Promise<Channel> | null = null;

    constructor(
        private readonly url: string,
        private readonly queueName: string,
        private readonly deadQueueName: string
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
                await channel.assertQueue(this.deadQueueName, { durable: true });


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
                    // обрабатываем задачу
                    await onMessage(msg);
                    channel.ack(msg);
                   
                } catch (err) {
                    logger.error({ err }, "Error processing rabbitmq message");
                    
                    const headers = msg.properties.headers || {};
                    const retries = typeof headers['x-retries'] === 'number' ? headers['x-retries'] : 0;
                    const maxRetries = 3;

                    if (retries < maxRetries) {
                        logger.warn(`RabbitMQ task failed. Retrying... attempt ${retries + 1} of ${maxRetries}`);
                        // повторная отправка в основную очередь с увеличенным счетчиком
                        channel.sendToQueue(this.queueName, msg.content, {
                            ...msg.properties,
                            headers: {
                                ...headers,
                                'x-retries': retries + 1
                            }
                        });
                    } else {
                        logger.error("RabbitMQ task failed after maximum retries. Moving to DLQ.");
                        // максимум попыток исчерпан, отправляем в DLQ (мертвую очередь)
                        channel.sendToQueue(this.deadQueueName, msg.content, {
                            ...msg.properties,
                            headers: {
                                ...headers,
                                'x-retries': retries + 1,
                                'x-error': err instanceof Error ? err.message : String(err)
                            }
                        });
                    }
                    
                    // обязательно подтверждаем текущее сообщение, чтобы оно удалилось из очереди, 
                    // так как мы переотправили его либо обратно с +1 к счетчику либо в DLQ
                    channel.ack(msg);
                } // конец catch
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

export const rabbitMQClient = new RabbitMQClient(config.rabbit_url, config.queue_name, config.dead_queue_name);
