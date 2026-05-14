import { BaseError } from "./baseError";

export class AIConnectionError extends BaseError {
    constructor(originalError?: Error) {
        super(
            `Failed to connect to AI. ${originalError?.message || ''}`.trim(),
            500,
            'AIConnectionError'
        );
    }
}

export class AIGettingSummaryError extends BaseError {
    constructor(originalError?: Error) {
        super(
            `Failed to get summary from AI. ${originalError?.message || ''}`.trim(),
            500,
            'AIGettingSummaryError'
        );
    }
}