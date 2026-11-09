import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import env from './config/env.js';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { health } from './controllers/health.controller.js';

const app = express();

// Behind nginx in production — without this every client appears to share the proxy's IP,
// which would make the per-IP rate limits useless
app.set('trust proxy', env.isProduction ? env.trustProxyHops : false);

app.use(helmet());

// Registered before the rate limiter on purpose: a host's own health probe polls this every few seconds and
// must never be throttled, or the platform would mark the service unhealthy.
// /api/health is the same check, reachable through a proxy that only forwards /api (e.g. Vercel rewrites).
app.get('/health', health);
app.get('/api/health', health);

app.use(cors({
  origin: env.allowedOrigins,
  credentials: true,
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use(errorHandler);

export default app;
