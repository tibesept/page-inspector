import { BaseError } from "./baseError.js";

export class ProcessJobError extends BaseError {
    constructor(originalError?: Error) {
        super(
            `Failed to complete the task. ${originalError?.message || ''}`.trim(),
            500,
            'ProcessJobError'
        );
    }
}