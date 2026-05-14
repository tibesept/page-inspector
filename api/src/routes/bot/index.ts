import { Router } from 'express';
import userRoutes from './user';
import jobRoutes from './job';
import logger from '../../logger';

const router = Router();

router.use('/users', (req, res, next) => {
    
    next()
}, userRoutes);
router.use('/jobs', jobRoutes);

export default router;