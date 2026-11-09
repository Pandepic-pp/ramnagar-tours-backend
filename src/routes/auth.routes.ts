import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sendOtpHandler, verifyOtpHandler, me, session, logout } from '../controllers/auth.controller.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { phoneSchema, verifyOtpSchema } from '../validators/auth.validator.js';

const router = Router();

const limiter = (max: number) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Every send-otp call costs an SMS, so this public endpoint is capped hard per IP
router.post('/send-otp',   limiter(5),  validate(phoneSchema),     sendOtpHandler);
router.post('/verify-otp', limiter(20), validate(verifyOtpSchema), verifyOtpHandler);
router.get('/me',          verifyToken, me);
router.get('/session',     optionalAuth, session);
router.post('/logout',     logout);

export default router;
