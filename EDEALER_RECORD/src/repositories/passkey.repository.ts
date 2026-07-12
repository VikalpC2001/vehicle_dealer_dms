import { prisma } from '../config/prisma';
import type { Passkey, User } from '@prisma/client';

/**
 * Data required to create a new passkey after WebAuthn registration verification.
 */
export interface CreatePasskeyData {
  userId: string;
  credentialId: string;
  credentialPublicKey: Buffer;
  counter: number;
  transports: string | null;
  deviceType: string | null;
  backedUp: boolean;
}

/**
 * Passkey with user relation. Used when verifying authentication to return user info.
 */
export type PasskeyWithUser = Passkey & {
  user: User;
};

/**
 * Creates a new passkey in the database.
 */
export async function createPasskey(data: CreatePasskeyData): Promise<Passkey> {
  return prisma.passkey.create({
    data: {
      userId: data.userId,
      credentialId: data.credentialId,
      credentialPublicKey: data.credentialPublicKey,
      counter: data.counter,
      transports: data.transports,
      deviceType: data.deviceType,
      backedUp: data.backedUp,
    },
  });
}

/**
 * Finds a passkey by credential ID including the associated user.
 * Used during passkey authentication verification.
 */
export async function findPasskeyByCredentialIdWithUser(
  credentialId: string,
): Promise<PasskeyWithUser | null> {
  return prisma.passkey.findUnique({
    where: { credentialId },
    include: { user: true },
  }) as Promise<PasskeyWithUser | null>;
}

/**
 * Updates the sign count (counter) for a passkey after successful authentication.
 * Prevents replay attacks.
 */
export async function updatePasskeyCounter(id: string, counter: number): Promise<Passkey> {
  return prisma.passkey.update({
    where: { id },
    data: { counter },
  });
}
