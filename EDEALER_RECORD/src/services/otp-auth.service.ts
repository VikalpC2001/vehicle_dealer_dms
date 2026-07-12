import crypto from 'crypto';

import type { OtpPurpose, User } from '@prisma/client';

import { config } from '../config';
import * as emailOtpRepository from '../repositories/email-otp.repository';
import * as userRepository from '../repositories/user.repository';
import { Role } from '../types';
import { AppError } from '../utils/app-error';
import { signPasswordResetToken } from '../utils/jwt';
import { issueUserAccessToken } from './access-token.service';

import { sendTransactionalEmail } from './email.service';

const OTP_LENGTH = 6;

/**
 * Generates a cryptographically secure 6-digit OTP string.
 */
export const generateSixDigitOtp = (): string => {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(OTP_LENGTH, '0');
};

/**
 * HMAC-SHA256 hash of the OTP for storage (never store plaintext OTP).
 */
export const hashOtp = (email: string, purpose: OtpPurpose, plainOtp: string): string => {
  return crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(`${email}:${purpose}:${plainOtp}`)
    .digest('hex');
};

/**
 * Sends signup verification OTP email.
 */
export const sendSignupOtpEmail = async (user: User, plainOtp: string): Promise<void> => {
  const subject = 'Verify your email — EDealer';
  const text = [
    `Hello ${user.userName},`,
    '',
    `Your verification code is: ${plainOtp}`,
    `This code expires in ${config.OTP_EXPIRES_MINUTES} minutes.`,
    '',
    'If you did not create an account, ignore this email.',
  ].join('\n');
  const html = `<p>Hello ${user.userName},</p><p>Your verification code is: <strong>${plainOtp}</strong></p><p>This code expires in ${config.OTP_EXPIRES_MINUTES} minutes.</p>`;
  await sendTransactionalEmail({ to: user.emailId, subject, text, html });
};

/**
 * Sends password-reset OTP email.
 */
export const sendPasswordResetOtpEmail = async (user: User, plainOtp: string): Promise<void> => {
  const subject = 'Password reset code — EDealer';
  const text = [
    `Hello ${user.userName},`,
    '',
    `Your password reset code is: ${plainOtp}`,
    `This code expires in ${config.OTP_EXPIRES_MINUTES} minutes.`,
    '',
    'If you did not request a reset, ignore this email.',
  ].join('\n');
  const html = `<p>Hello ${user.userName},</p><p>Your password reset code is: <strong>${plainOtp}</strong></p><p>This code expires in ${config.OTP_EXPIRES_MINUTES} minutes.</p>`;
  await sendTransactionalEmail({ to: user.emailId, subject, text, html });
};

/**
 * Creates and emails a signup OTP for the user.
 */
export const issueSignupOtp = async (user: User): Promise<void> => {
  const plainOtp = generateSixDigitOtp();
  const otpHash = hashOtp(user.emailId, 'SIGNUP_EMAIL_VERIFICATION', plainOtp);
  const expiresAt = new Date(Date.now() + config.OTP_EXPIRES_MINUTES * 60 * 1000);

  await emailOtpRepository.createEmailOtp({
    email: user.emailId,
    userId: user.userId,
    purpose: 'SIGNUP_EMAIL_VERIFICATION',
    otpHash,
    expiresAt,
  });

  await sendSignupOtpEmail(user, plainOtp);
};

/**
 * Creates and emails a password-reset OTP for the user.
 */
export const issuePasswordResetOtp = async (user: User): Promise<void> => {
  const plainOtp = generateSixDigitOtp();
  const otpHash = hashOtp(user.emailId, 'PASSWORD_RESET', plainOtp);
  const expiresAt = new Date(Date.now() + config.OTP_EXPIRES_MINUTES * 60 * 1000);

  await emailOtpRepository.createEmailOtp({
    email: user.emailId,
    userId: user.userId,
    purpose: 'PASSWORD_RESET',
    otpHash,
    expiresAt,
  });

  await sendPasswordResetOtpEmail(user, plainOtp);
};

/**
 * Verifies signup OTP, marks email verified, returns JWT session.
 */
export const verifySignupOtp = async (
  email: string,
  plainOtp: string,
): Promise<{ user: User; token: string }> => {
  const row = await emailOtpRepository.findLatestActiveOtp(email, 'SIGNUP_EMAIL_VERIFICATION');
  if (!row) {
    throw new AppError('Invalid or expired verification code', 400, 4006);
  }

  const expected = hashOtp(email, 'SIGNUP_EMAIL_VERIFICATION', plainOtp);
  if (expected !== row.otpHash) {
    throw new AppError('Invalid or expired verification code', 400, 4006);
  }

  await emailOtpRepository.deleteEmailOtpById(row.emailOtpId);

  const user = await userRepository.setUserEmailVerified(row.userId, true);

  const token = await issueUserAccessToken({
    userId: user.userId,
    email: user.emailId,
    role: Role.USER,
  });

  return { user, token };
};

/**
 * Verifies password-reset OTP and returns a short-lived JWT for reset-password only.
 */
export const verifyPasswordResetOtp = async (
  email: string,
  plainOtp: string,
): Promise<{ resetToken: string }> => {
  const row = await emailOtpRepository.findLatestActiveOtp(email, 'PASSWORD_RESET');
  if (!row) {
    throw new AppError('Invalid or expired reset code', 400, 4007);
  }

  const expected = hashOtp(email, 'PASSWORD_RESET', plainOtp);
  if (expected !== row.otpHash) {
    throw new AppError('Invalid or expired reset code', 400, 4007);
  }

  await emailOtpRepository.deleteEmailOtpById(row.emailOtpId);

  const user = await userRepository.findUserById(row.userId);
  if (!user) {
    throw new AppError('User not found', 404, 4004);
  }

  const resetToken = signPasswordResetToken({
    sub: user.userId,
    email: user.emailId,
    role: Role.USER,
  });

  return { resetToken };
};
