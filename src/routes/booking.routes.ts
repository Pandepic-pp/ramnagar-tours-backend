import { Router } from 'express';
import { create, listMine, cancel } from '../controllers/booking.controller.js';
import { verifyToken } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { createBookingSchema } from '../validators/booking.validator.js';

const router = Router();

router.use(verifyToken);

router.post('/',              validate(createBookingSchema), create);
router.get('/',               listMine);
router.patch('/:id/cancel',   cancel);

export default router;
