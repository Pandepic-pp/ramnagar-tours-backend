import Joi from 'joi';

const phonePattern = Joi.string()
  .pattern(/^(\+91|91)?[6-9]\d{9}$/)
  .required()
  .messages({ 'string.pattern.base': 'phone must be a valid Indian mobile number' });

const phoneSchema = Joi.object({ phone: phonePattern });

const verifyOtpSchema = Joi.object({
  phone: phonePattern,
  otp: Joi.string().length(6).pattern(/^\d+$/).required()
    .messages({ 'string.length': 'OTP must be 6 digits', 'string.pattern.base': 'OTP must be numeric' }),
});

export { phoneSchema, verifyOtpSchema };
