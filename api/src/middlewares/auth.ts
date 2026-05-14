import { Request, Response, NextFunction } from "express";
import logger from "../logger";

export const authMiddleware = (allowedKeys: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        logger.debug("In auth middleware");

        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            return res.status(401).json({ message: "No auth header" });
        }

        const token = authHeader.split(" ")[1];
        if (!token || !allowedKeys.includes(token)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        logger.debug("Authed successfully");
        next();
    };
};
