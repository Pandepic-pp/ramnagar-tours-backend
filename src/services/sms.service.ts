import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

interface TwoFactorResponse {
  Status: string;
  Details: string;
}

// 2Factor.in is used purely as the SMS carrier — the OTP is generated and verified by us.
const sendOtpSms = async (phone10: string, otp: string): Promise<void> => {
  if (!env.twoFactorApiKey) {
    // Only reachable outside production — env.ts requires the key when NODE_ENV=production
    console.log(`[sms] TWO_FACTOR_API_KEY not set — OTP for ${phone10}: ${otp}`);
    return;
  }

  const template = env.twoFactorTemplate ? `/${encodeURIComponent(env.twoFactorTemplate)}` : '';
  const url = `https://2factor.in/API/V1/${env.twoFactorApiKey}/SMS/${phone10}/${otp}${template}`;

  let data: TwoFactorResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    data = (await res.json()) as TwoFactorResponse;
  } catch {
    // The error is deliberately not logged: fetch errors can echo the URL, which contains the API key
    throw new ApiError(502, 'Could not reach the SMS provider. Please try again.');
  }

  if (data.Status !== 'Success') {
    console.error(`[sms] 2Factor rejected the request: ${data.Details}`);
    throw new ApiError(502, 'Could not send the OTP. Please try again.');
  }
};

export { sendOtpSms };
