import { BaseError } from "./baseError";

export class NotFoundError extends BaseError {
    constructor(message: string = "Resource not found") {
        super(message, 404, "NotFoundError");
    }
}
