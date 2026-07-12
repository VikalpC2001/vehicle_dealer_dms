import crypto from 'crypto';

/**
 * Generates a cryptographically strong opaque token for email links (hex, 64 chars).
 *
 * @returns Random token string.
 */
export const generateOpaqueToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
