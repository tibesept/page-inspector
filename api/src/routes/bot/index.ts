import { Router } from 'express';
import userRoutes from './user';
import jobRoutes from './job';
import paymentRoutes from './payment';
import cartRoutes from './cart';
import monitorRoutes from './monitor';
import notificationRoutes from './notification';
import logger from '../../logger';

const router = Router();

router.use('/users', (req, res, next) => {
    
    next()
}, userRoutes);
router.use('/jobs', jobRoutes);
router.use('/payments', paymentRoutes);
router.use('/cart', cartRoutes);
router.use('/monitors', monitorRoutes);
router.use('/notifications', notificationRoutes);

export default router;