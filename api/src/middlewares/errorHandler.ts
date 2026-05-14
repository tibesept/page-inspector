import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { BaseError } from '../errors/baseError';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // Ошибки от Zod
    if (err instanceof z.ZodError) {
        req.log.info({ errors: err.issues }, 'Validation error. Respond as bad request');
        return res.status(400).json({
            code: 400,
            message: "Bad request"
        });
    }

    // Ошибки от Prisma
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003') { // ForeignKeyConstraintViolation
            req.log.warn(err, 'ForeignKeyConstraintViolation (in errorhandler)');
            return res.status(500).json({ message: `internal server error` });
        }
        if(err.code === 'P2025') { // No record was found for an update
            req.log.error(err, 'Prisma: No record was found for an update');
            return res.status(404).json({ message: `No record was found for an update` });
        }
    }

    // Кастомные ошибки
    if (err instanceof BaseError) {
        req.log.error({ err }, 'Caught custom error');
        return res.status(err.code).json({
            code: err.code,
            message: err.message
        });
    }



    req.log.error({ err }, 'Internal server error');
    return res.status(500).json({ message: "Internal server error" }); // return чтоб не было "Can't set headers after they are sent"
};

export default errorHandler;