import { BaseError } from "./baseError";

export class RabbitMQConnectionError extends BaseError {
    constructor(originalError?: Error) {
        super(
            `Failed to connect to RabbitMQ. ${originalError?.message || ''}`.trim(),
            500,
            'RabbitMQConnectionError'
        );
    }
}

export class RabbitMQChannelError extends BaseError {
    constructor(originalError?: Error) {
        super(
            `Failed to create a channel in RabbitMQ. ${originalError?.message || ''}`.trim(),
            500,
            'RabbitMQChannelError'
        );
    }
}

export class RabbitMQPublishError extends BaseError {
    constructor(task: unknown, originalError?: Error) {
        super(
            `Failed to send task to RabbitMQ queue. Task: ${JSON.stringify(task)}. ${originalError?.message || ''}`.trim(),
            500,
            'RabbitMQPublishError'
        );
    }
}

export class RabbitMQCloseError extends BaseError {
    constructor(originalError?: Error) {
        super(
            `Failed to properly close RabbitMQ connection. ${originalError?.message || ''}`.trim(),
            500,
            'RabbitMQCloseError'
        );
    }
}