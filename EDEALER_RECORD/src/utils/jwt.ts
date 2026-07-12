import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import type { JwtPayload } from '../types';

/**
 * Signs a JWT access token for the given payload (`purpose: ACCESS`).
 *
 * @param payload - The data to encode in the token.
 * @returns A signed JWT string.
 */
export const signAccessToken = (
  payload: Omit<JwtPayload, 'iat' | 'exp' | 'purpose'>,
): string => {
  const full: JwtPayload = { ...payload, purpose: 'ACCESS' };
  const options: SignOptions = { expiresIn: config.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(full, config.JWT_SECRET, options);
};

/**
 * Signs a short-lived JWT used only to authorize `POST /auth/reset-password` after OTP verification.
 *
 * @param payload - User claims (without `purpose`; it is set to `PASSWORD_RESET`).
 * @returns A signed JWT string.
 */
export const signPasswordResetToken = (
  payload: Omit<JwtPayload, 'iat' | 'exp' | 'purpose'>,
): string => {
  const full: JwtPayload = { ...payload, purpose: 'PASSWORD_RESET' };
  const options: SignOptions = {
    expiresIn: config.JWT_PASSWORD_RESET_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(full, config.JWT_SECRET, options);
};

/**
 * Signs a JWT refresh token for the given subject.
 *
 * @param sub - The user ID to embed as the subject claim.
 * @returns A signed JWT refresh token string.
 */
export const signRefreshToken = (sub: string): string => {
  const options: SignOptions = { expiresIn: config.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };
  // `purpose: REFRESH` lets `authenticate` reject it as an access token and `/auth/refresh` accept only it.
  return jwt.sign({ sub, purpose: 'REFRESH' }, config.JWT_SECRET, options);
};

/**
 * Verifies and decodes a JWT token.
 *
 * @param token - The JWT string to verify.
 * @returns The decoded `JwtPayload`.
 * @throws `JsonWebTokenError` if the token is invalid or expired.
 */
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
};
