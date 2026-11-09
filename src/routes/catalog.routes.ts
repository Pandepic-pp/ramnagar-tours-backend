import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getCatalog, quote } from '../controllers/catalog.controller.js';
import validate from '../middleware/validate.js';
import { quoteSchema } from '../validators/booking.validator.js';

const router = Router();

// Quotes are pure computation (no SMS cost), but a loop hammering them is still worth capping
const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many price checks, please try again in a few minutes.' },
});

router.get('/catalog', getCatalog);
router.post('/quotes', quoteLimiter, validate(quoteSchema), quote);

export default router;
