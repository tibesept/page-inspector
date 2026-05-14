import { Router } from 'express';
import botRoutes from './bot';
import workerRoutes from './worker';
import { authMiddleware } from '../middlewares/auth';
import { config } from '../config';
import logger from '../logger';

const router = Router();

router.use('/bot', (req, res, next) => {

    logger.debug("Got /bot request")
    authMiddleware([config.bot_auth_token])(req, res, next);

}, botRoutes);


router.use('/worker', (req, res, next) => {

    logger.debug("Got /worker request")
    authMiddleware([config.worker_auth_token])(req, res, next);

}, workerRoutes);

export default router;