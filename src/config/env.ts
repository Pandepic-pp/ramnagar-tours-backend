import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

// A fixed OTP for development, so testing does not spend SMS credits. Never allowed in production.
const demoOtp = process.env.DEMO_OTP?.trim() ?? '';
if (demoOtp && isProduction) throw new Error('DEMO_OTP must not be set in production');
if (demoOtp && !/^\d{6}$/.test(demoOtp)) throw new Error('DEMO_OTP must be exactly 6 digits');
if (demoOtp) console.warn('[auth] DEMO_OTP is set: every sign-in accepts the fixed code and no SMS is sent');

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 5100),
  mongodbUri: required('MONGODB_URI'),
  jwtSecret,
  jwtExpiresInDays: Number(process.env.JWT_EXPIRES_IN_DAYS ?? 30),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Blank key is only tolerated outside production (OTP is then logged to the console)
  twoFactorApiKey: isProduction ? required('TWO_FACTOR_API_KEY') : (process.env.TWO_FACTOR_API_KEY?.trim() ?? ''),
  twoFactorTemplate: process.env.TWO_FACTOR_TEMPLATE?.trim() ?? '',
  demoOtp,
  // Hops of proxies in front of the app. 1 = just the host's load balancer (Render). 2 = Vercel proxying /api to Render.
  // Wrong value makes every visitor share one IP, which would trip the per-IP rate limits for everyone.
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 1),
  // Public URL the health monitor pings. Render sets RENDER_EXTERNAL_URL itself. Blank = ping localhost.
  healthCheckUrl: (process.env.HEALTH_CHECK_URL ?? process.env.RENDER_EXTERNAL_URL ?? '').trim().replace(/\/$/, ''),
};

export default env;
