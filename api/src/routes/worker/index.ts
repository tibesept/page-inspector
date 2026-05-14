import { Router } from 'express';
import jobRoutes from './job';
// import userRoutes from './user';

const router = Router();

router.use('/jobs', jobRoutes);
// router.use('/users', userRoutes);

export default router;