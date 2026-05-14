export abstract class BaseError extends Error {
    constructor(
        message: string,
        public readonly code: number,
        public readonly name: string,
    ) {
        super(message);

        // это нужно для правильной работы instanceof
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this);
    }
}
