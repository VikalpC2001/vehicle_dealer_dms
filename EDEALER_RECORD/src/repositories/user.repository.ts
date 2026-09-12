import { prisma } from '../config/prisma';
import type { User } from '@prisma/client';

/**
 * Data required to create a new user. Maps to User table columns (excluding auto-generated).
 */
export interface CreateUserData {
  emailId: string;
  password: string;
  userName: string;
  mobileNo: string;
  gender: string | null;
  /** Optional verified flag; omitted preserves the schema default (`false`). */
  emailVerified?: boolean;
}

/**
 * User including passkeys relation. Used for WebAuthn flows.
 */
export type UserWithPasskeys = User & {
  passkeys: Array<{
    id: string;
    credentialId: string;
    transports: string | null;
  }>;
};

/**
 * Creates a new user in the database.
 */
export async function createUser(data: CreateUserData): Promise<User> {
  return prisma.user.create({
    data: {
      emailId: data.emailId,
      password: data.password,
      userName: data.userName,
      mobileNo: data.mobileNo,
      gender: data.gender,
      emailVerified: data.emailVerified,
    },
  });
}

/**
 * Finds a user by email (emailId). Returns null if not found.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { emailId: email },
  });
}

/**
 * Deletes a user (cascades their dealer/agent link rows). Used to discard an abandoned, unverified
 * self-registration so the same email can be re-registered.
 *
 * @param userId - Primary key.
 */
export async function deleteUser(userId: string): Promise<User> {
  return prisma.user.delete({ where: { userId } });
}

/**
 * Finds a user by ID. Returns null if not found.
 */
export async function findUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { userId },
  });
}

/**
 * Finds a user by ID including their passkeys. Used for passkey registration options.
 */
export async function findUserByIdWithPasskeys(userId: string): Promise<UserWithPasskeys | null> {
  return prisma.user.findUnique({
    where: { userId },
    include: { passkeys: true },
  }) as Promise<UserWithPasskeys | null>;
}

/**
 * Finds a user by email including their passkeys. Used for passkey login options.
 */
export async function findUserByEmailWithPasskeys(email: string): Promise<UserWithPasskeys | null> {
  return prisma.user.findUnique({
    where: { emailId: email },
    include: { passkeys: true },
  }) as Promise<UserWithPasskeys | null>;
}

/**
 * Updates password hash for a user.
 *
 * @param userId - User id.
 * @param hashedPassword - Bcrypt hash.
 */
export async function updateUserPassword(userId: string, hashedPassword: string): Promise<User> {
  return prisma.user.update({
    where: { userId },
    data: { password: hashedPassword },
  });
}

/**
 * Sets email verified flag.
 *
 * @param userId - User id.
 * @param emailVerified - New value.
 */
export async function setUserEmailVerified(userId: string, emailVerified: boolean): Promise<User> {
  return prisma.user.update({
    where: { userId },
    data: { emailVerified },
  });
}
