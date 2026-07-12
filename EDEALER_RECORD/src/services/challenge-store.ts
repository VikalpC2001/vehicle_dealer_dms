/**
 * In-memory store for WebAuthn challenges (registration and authentication).
 * Challenges are single-use and must be consumed during verify.
 *
 * For production with multiple instances, replace with Redis or a shared store
 * keyed by challenge with TTL.
 */

const AUTH_PREFIX = 'auth:';

interface StoredRegistration {
  type: 'registration';
  userId: string;
}

const challengeToRegistration = new Map<string, StoredRegistration>();
const authChallenges = new Set<string>();

/**
 * Stores a registration challenge for the given user.
 * Call after generating registration options; use the options.challenge value.
 */
export function setRegistrationChallenge(userId: string, challenge: string): void {
  challengeToRegistration.set(challenge, { type: 'registration', userId });
}

/**
 * Verifies that the challenge was issued for registration and for the given userId.
 * Removes the challenge (one-time use). Returns true if valid and consumed.
 */
export function consumeRegistrationChallenge(challenge: string, userId: string): boolean {
  const entry = challengeToRegistration.get(challenge);
  if (!entry || entry.type !== 'registration' || entry.userId !== userId) return false;
  challengeToRegistration.delete(challenge);
  return true;
}

/**
 * Stores an authentication challenge.
 * Call after generating authentication options.
 */
export function setAuthChallenge(challenge: string): void {
  authChallenges.add(AUTH_PREFIX + challenge);
}

/**
 * Consumes an authentication challenge (one-time use).
 * Returns true if the challenge was stored and is now consumed.
 */
export function consumeAuthChallenge(challenge: string): boolean {
  const key = AUTH_PREFIX + challenge;
  if (!authChallenges.has(key)) return false;
  authChallenges.delete(key);
  return true;
}
