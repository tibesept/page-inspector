import { Router } from 'express';
import userRoutes from './user';
import jobRoutes from './job';
import paymentRoutes from './payment';
import cartRoutes from './cart';
import logger from '../../logger';

const router = Router();

router.use('/users', (req, res, next) => {
    
    next()
}, userRoutes);
router.use('/jobs', jobRoutes);
router.use('/payments', paymentRoutes);
router.use('/cart', cartRoutes);

export default router;