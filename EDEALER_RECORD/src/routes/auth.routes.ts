import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate, authenticatePasswordReset } from '../middlewares/auth.middleware';
import {
  register,
  login,
  refreshAccessToken,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyLoginOptions,
  passkeyLoginVerify,
} from '../controllers/auth.controller';
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  verifyOtpBodySchema,
  resendOtpBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  passkeyRegisterOptionsBodySchema,
  passkeyRegisterVerifyBodySchema,
  passkeyLoginOptionsBodySchema,
  passkeyLoginVerifyBodySchema,
} from '../validations/auth.validation';

const router = Router();

/** Password registration */
router.post(
  '/register',
  validate(registerBodySchema),
  asyncHandler(register),
);

/** Password login */
router.post(
  '/login',
  validate(loginBodySchema),
  asyncHandler(login),
);

/** Refresh: exchange a valid refresh token for a new access token (+ rotated refresh token) */
router.post(
  '/refresh',
  validate(refreshBodySchema),
  asyncHandler(refreshAccessToken),
);

/** Email OTP verification & password reset (no auth) */
router.post(
  '/verify-otp',
  validate(verifyOtpBodySchema),
  asyncHandler(verifyOtp),
);

router.post(
  '/resend-otp',
  validate(resendOtpBodySchema),
  asyncHandler(resendOtp),
);

router.post(
  '/forgot-password',
  validate(forgotPasswordBodySchema),
  asyncHandler(forgotPassword),
);

router.post(
  '/reset-password',
  authenticatePasswordReset,
  validate(resetPasswordBodySchema),
  asyncHandler(resetPassword),
);

/** Passkey registration (requires prior auth) */
router.post(
  '/passkey/register/options',
  authenticate,
  validate(passkeyRegisterOptionsBodySchema),
  asyncHandler(passkeyRegisterOptions),
);

router.post(
  '/passkey/register/verify',
  authenticate,
  validate(passkeyRegisterVerifyBodySchema),
  asyncHandler(passkeyRegisterVerify),
);

/** Passkey login (no prior auth) */
router.post(
  '/passkey/login/options',
  validate(passkeyLoginOptionsBodySchema),
  asyncHandler(passkeyLoginOptions),
);

router.post(
  '/passkey/login/verify',
  validate(passkeyLoginVerifyBodySchema),
  asyncHandler(passkeyLoginVerify),
);

export default router;
