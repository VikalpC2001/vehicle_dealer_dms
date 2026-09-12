import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import {
  registerUser,
  findUserByEmail,
  verifyPassword,
  findUserById,
  resetPasswordForUser,
} from '../services/password-auth.service';
import {
  issueSignupOtp,
  issuePasswordResetOtp,
  verifySignupOtp,
  verifyPasswordResetOtp,
} from '../services/otp-auth.service';
import { logUnknownError } from '../utils/logger';
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
} from '../services/passkey.service';
import { issueUserAccessToken, resolveFirmApproval } from '../services/access-token.service';
import { signRefreshToken, verifyToken } from '../utils/jwt';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import { Role } from '../types';
import { getPrimaryDealerIdForUser } from '../services/dealer-wise-user.service';
import { getPrimaryAgentIdForUser } from '../services/agent-wise-user.service';
import type {
  LoginBody,
  RegisterBody,
  PasskeyRegisterOptionsBody,
  PasskeyRegisterVerifyBody,
  PasskeyLoginOptionsBody,
  PasskeyLoginVerifyBody,
  VerifyOtpBody,
  ResendOtpBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  RefreshBody,
} from '../validations/auth.validation';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

/**
 * Builds the `user` object for password or passkey login, including `dealerId` from `DealerWiseUser` (at most one row per user).
 */
const buildLoginUserPayload = async (
  user: Pick<User, 'userId' | 'emailId' | 'userName' | 'emailVerified' | 'isSuperAdmin'>,
): Promise<{
  userId: string;
  emailId: string;
  userName: string;
  emailVerified: boolean;
  dealerId: string | null;
  agentId: string | null;
  isSuperAdmin: boolean;
  approvalStatus: string;
  approvalReason: string | null;
}> => {
  const [dealerId, agentId] = await Promise.all([
    getPrimaryDealerIdForUser(user.userId),
    getPrimaryAgentIdForUser(user.userId),
  ]);
  const { approvalStatus, approvalReason } = await resolveFirmApproval(dealerId, agentId);
  return {
    userId: user.userId,
    emailId: user.emailId,
    userName: user.userName,
    emailVerified: user.emailVerified,
    dealerId,
    agentId,
    isSuperAdmin: user.isSuperAdmin,
    approvalStatus,
    approvalReason,
  };
};

/**
 * GET /auth/me
 * Returns the current user with a fresh (DB-read) approval state — used by the pending screen to
 * detect approval without re-login.
 */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await findUserById(req.user.sub);
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND, 4040);
  }
  const userPayload = await buildLoginUserPayload(user);
  sendSuccess(res, 'Current user', { user: userPayload });
}

/**
 * POST /auth/register
 * Creates a new user; sends a 6-digit OTP to verify email. No access token until OTP is verified.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, userName, mobileNo, gender } = req.body as RegisterBody;
  const user = await registerUser({ email, password, userName, mobileNo, gender });
  void issueSignupOtp(user).catch((err: unknown) => {
    logUnknownError('Failed to send signup OTP', err);
  });
  sendSuccess(
    res,
    'Account created. Enter the verification code sent to your email.',
    {
      user: {
        userId: user.userId,
        emailId: user.emailId,
        userName: user.userName,
        mobileNo: user.mobileNo,
        gender: user.gender,
        emailVerified: user.emailVerified,
      },
    },
    StatusCodes.CREATED,
  );
}

/**
 * POST /auth/login
 * Authenticates with email and password; returns JWT and user info.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginBody;
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password', StatusCodes.UNAUTHORIZED, 4010);
  }
  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    throw new AppError('Invalid email or password', StatusCodes.UNAUTHORIZED, 4010);
  }
  if (config.REQUIRE_EMAIL_VERIFIED_FOR_LOGIN && !user.emailVerified) {
    throw new AppError(
      'Please verify your email before logging in',
      StatusCodes.FORBIDDEN,
      4031,
    );
  }
  const token = await issueUserAccessToken({
    userId: user.userId,
    email: user.emailId,
    role: Role.USER,
  });
  const refreshToken = signRefreshToken(user.userId);
  const userPayload = await buildLoginUserPayload(user);
  sendSuccess(res, 'Login successful', {
    user: userPayload,
    token,
    refreshToken,
  });
}

/**
 * POST /auth/refresh
 * Exchanges a valid refresh token for a fresh access token AND a rotated refresh token, so an
 * active session never hits the refresh-token expiry. Public route; the refresh token is validated
 * statelessly by signature + `purpose: REFRESH`. The new access token is rebuilt from the current
 * user (so dealer/agent/admin claims stay in sync).
 */
export async function refreshAccessToken(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshBody;
  let userId: string;
  try {
    const payload = verifyToken(refreshToken);
    if (payload.purpose !== 'REFRESH') {
      throw new Error('not a refresh token');
    }
    userId = payload.sub;
  } catch {
    throw new AppError('Invalid or expired refresh token', StatusCodes.UNAUTHORIZED, 4017);
  }
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError('Invalid or expired refresh token', StatusCodes.UNAUTHORIZED, 4017);
  }
  const token = await issueUserAccessToken({
    userId: user.userId,
    email: user.emailId,
    role: Role.USER,
  });
  const rotatedRefreshToken = signRefreshToken(user.userId);
  sendSuccess(res, 'Token refreshed', { token, refreshToken: rotatedRefreshToken });
}

/**
 * POST /auth/passkey/register/options
 * Returns WebAuthn registration options for the authenticated user.
 * User must be authenticated (e.g. via password login) and can only add passkey to their own account.
 */
export async function passkeyRegisterOptions(req: Request, res: Response): Promise<void> {
  const { userId } = req.body as PasskeyRegisterOptionsBody;
  if (req.user && req.user.sub !== userId) {
    throw new AppError('You can only add a passkey to your own account', StatusCodes.FORBIDDEN, 4030);
  }
  const options = await getRegistrationOptions(userId);
  sendSuccess(res, 'Passkey registration options', { options });
}

/**
 * POST /auth/passkey/register/verify
 * Verifies the WebAuthn registration response and stores the new passkey.
 */
export async function passkeyRegisterVerify(req: Request, res: Response): Promise<void> {
  const { userId, credential } = req.body as PasskeyRegisterVerifyBody;
  if (req.user && req.user.sub !== userId) {
    throw new AppError('You can only add a passkey to your own account', StatusCodes.FORBIDDEN, 4030);
  }
  await verifyRegistration(userId, credential as unknown as RegistrationResponseJSON);
  sendSuccess(res, 'Passkey registered successfully', {});
}

/**
 * POST /auth/passkey/login/options
 * Returns WebAuthn authentication options for the given email (no auth required).
 */
export async function passkeyLoginOptions(req: Request, res: Response): Promise<void> {
  const { email } = req.body as PasskeyLoginOptionsBody;
  const options = await getAuthenticationOptions(email);
  sendSuccess(res, 'Passkey authentication options', { options });
}

/**
 * POST /auth/passkey/login/verify
 * Verifies the WebAuthn authentication response and returns JWT and user info.
 */
export async function passkeyLoginVerify(req: Request, res: Response): Promise<void> {
  const { credential } = req.body as PasskeyLoginVerifyBody;
  const { userId } = await verifyAuthentication(credential as unknown as AuthenticationResponseJSON);
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError('User not found after passkey verification', StatusCodes.INTERNAL_SERVER_ERROR, 5001);
  }
  if (config.REQUIRE_EMAIL_VERIFIED_FOR_LOGIN && !user.emailVerified) {
    throw new AppError(
      'Please verify your email before logging in',
      StatusCodes.FORBIDDEN,
      4031,
    );
  }
  const token = await issueUserAccessToken({
    userId: user.userId,
    email: user.emailId,
    role: Role.USER,
  });
  const refreshToken = signRefreshToken(user.userId);
  const userPayload = await buildLoginUserPayload(user);
  sendSuccess(res, 'Login successful', {
    user: userPayload,
    token,
    refreshToken,
  });
}

/**
 * POST /auth/verify-otp
 * Verifies OTP for signup (returns access token) or password reset (returns short-lived reset JWT).
 */
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { email, otp, purpose } = req.body as VerifyOtpBody;
  if (purpose === 'SIGNUP_EMAIL_VERIFICATION') {
    const { user, token } = await verifySignupOtp(email, otp);
    const refreshToken = signRefreshToken(user.userId);
    const userPayload = await buildLoginUserPayload(user);
    sendSuccess(res, 'Email verified successfully', {
      user: userPayload,
      token,
      refreshToken,
    });
    return;
  }
  const { resetToken } = await verifyPasswordResetOtp(email, otp);
  sendSuccess(res, 'Code verified. Send Authorization: Bearer resetToken to reset-password.', {
    resetToken,
  });
}

/**
 * POST /auth/resend-otp
 * Re-sends OTP for signup or password reset (generic success to avoid user enumeration).
 */
export async function resendOtp(req: Request, res: Response): Promise<void> {
  const { email, purpose } = req.body as ResendOtpBody;
  const user = await findUserByEmail(email);
  if (purpose === 'SIGNUP_EMAIL_VERIFICATION') {
    if (user && !user.emailVerified) {
      void issueSignupOtp(user).catch((err: unknown) => {
        logUnknownError('Failed to resend signup OTP', err);
      });
    }
  } else if (user) {
    void issuePasswordResetOtp(user).catch((err: unknown) => {
      logUnknownError('Failed to resend password reset OTP', err);
    });
  }
  sendSuccess(res, 'If applicable, a code has been sent to your email.', {});
}

/**
 * POST /auth/forgot-password
 * Sends a password reset OTP (same response whether or not the email exists).
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordBody;
  const user = await findUserByEmail(email);
  if (user) {
    void issuePasswordResetOtp(user).catch((err: unknown) => {
      logUnknownError('Failed to send password reset OTP', err);
    });
  }
  sendSuccess(
    res,
    'If an account exists for this email, a reset code has been sent.',
    {},
  );
}

/**
 * POST /auth/reset-password
 * Sets a new password using the Bearer token from OTP verification (`purpose: PASSWORD_RESET`).
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { password } = req.body as ResetPasswordBody;
  await resetPasswordForUser(req.user.sub, password);
  sendSuccess(res, 'Password has been reset. You can log in with your new password.', {});
}
