import { Router } from 'express';
import { adminList, adminAssign, adminComplete } from '../controllers/booking.controller.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { assignBookingSchema } from '../validators/booking.validator.js';

const router = Router();

router.use(verifyToken, requireAdmin);

router.get('/bookings',              adminList);
router.patch('/bookings/:id/assign', validate(assignBookingSchema), adminAssign);
router.patch('/bookings/:id/complete', adminComplete);

export default router;
