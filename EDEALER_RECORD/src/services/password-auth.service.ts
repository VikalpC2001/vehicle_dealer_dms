import bcrypt from 'bcrypt';
import { config } from '../config';
import { AppError } from '../utils/app-error';
import { StatusCodes } from 'http-status-codes';
import type { User } from '@prisma/client';
import * as userRepository from '../repositories/user.repository';

/**
 * Hashes a plain-text password using bcrypt.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, config.BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies a plain-text password against a bcrypt hash.
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Finds a user by email (emailId). Used for login and passkey options.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  return userRepository.findUserByEmail(email);
}

/**
 * Finds a user by ID. Used for passkey registration and auth.
 */
export async function findUserById(userId: string): Promise<User | null> {
  return userRepository.findUserById(userId);
}

/**
 * Input for user registration. Matches User table fields that can be set at signup.
 */
export interface RegisterUserInput {
  email: string;
  password: string;
  userName?: string;
  mobileNo?: string;
  gender?: string | null;
}

/**
 * Registers a new user with all provided fields matching the User table.
 * Password is hashed before storage. userName defaults to email if not provided.
 * mobileNo defaults to empty string (required by schema).
 */
export async function registerUser(input: RegisterUserInput): Promise<User> {
  const existing = await userRepository.findUserByEmail(input.email);
  if (existing) {
    throw new AppError('An account with this email already exists', StatusCodes.CONFLICT, 4091);
  }
  const hashedPassword = await hashPassword(input.password);
  return userRepository.createUser({
    emailId: input.email,
    password: hashedPassword,
    userName: input.userName ?? input.email,
    mobileNo: input.mobileNo ?? '',
    gender: input.gender ?? null,
  });
}

/**
 * Sets a new password for an authenticated user (e.g. after password-reset JWT).
 *
 * @param userId - User id from JWT `sub`.
 * @param newPassword - Plain password (min length enforced by route validation).
 */
export async function resetPasswordForUser(userId: string, newPassword: string): Promise<void> {
  const hashed = await hashPassword(newPassword);
  await userRepository.updateUserPassword(userId, hashed);
}
