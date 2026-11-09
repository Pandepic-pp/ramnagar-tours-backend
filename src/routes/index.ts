import { Router } from 'express';
import authRoutes    from './auth.routes.js';
import bookingRoutes from './booking.routes.js';
import adminRoutes   from './admin.routes.js';
import catalogRoutes from './catalog.routes.js';

const router = Router();

router.use('/auth',     authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/admin',    adminRoutes);
router.use('/',         catalogRoutes);

export default router;
