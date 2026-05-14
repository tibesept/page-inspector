import { BaseError } from "./baseError";

export class BadRequestError extends BaseError {
    constructor(message: string = 'Неверный запрос') {
      super(message, 400, 'BadRequestError');
    }
  }