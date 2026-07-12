import { StatusCodes } from 'http-status-codes';
import * as dealerRepository from '../repositories/dealer.repository';
import * as dealerWiseUserRepository from '../repositories/dealer-wise-user.repository';
import type { DealerWiseUserWithUser } from '../repositories/dealer-wise-user.repository';
import * as userRepository from '../repositories/user.repository';
import { hashPassword } from './password-auth.service';
import { AppError } from '../utils/app-error';

export interface CreateDealerWiseUserInput {
  dealerId: string;
  userId: string;
}

export interface UpdateDealerWiseUserInput {
  userId: string;
}

export interface CreateDealerWiseUserWithUserInput {
  dealerId: string;
  userName: string;
  emailId: string;
  mobileNo: string;
  password: string;
}

/**
 * Ensures the dealer exists.
 */
const assertDealerExists = async (dealerId: string): Promise<void> => {
  const dealer = await dealerRepository.findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }
};

/**
 * Ensures the user exists.
 */
const assertUserExists = async (userId: string): Promise<void> => {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND, 4045);
  }
};

/**
 * Returns a dealer-wise user row or throws 404.
 */
export async function getDealerWiseUserById(dwuId: string): Promise<DealerWiseUserWithUser> {
  const row = await dealerWiseUserRepository.findDealerWiseUserById(dwuId);
  if (!row) {
    throw new AppError('Dealer user assignment not found', StatusCodes.NOT_FOUND, 4053);
  }
  return row;
}

/**
 * Creates an assignment; each `userId` may appear at most once in the table (one dealer only).
 */
export async function createDealerWiseUser(
  input: CreateDealerWiseUserInput,
): Promise<DealerWiseUserWithUser> {
  await assertDealerExists(input.dealerId);
  await assertUserExists(input.userId);
  const existing = await dealerWiseUserRepository.findDealerWiseUserByUserId(input.userId);
  if (existing) {
    throw new AppError(
      'This user is already linked to a dealer',
      StatusCodes.CONFLICT,
      4106,
    );
  }
  return dealerWiseUserRepository.createDealerWiseUser({
    dealerId: input.dealerId,
    userId: input.userId,
  });
}

/**
 * Creates a brand-new verified user and links them to the dealer in one step.
 * Validates the dealer, rejects a duplicate email (4091), hashes the password,
 * creates the user with `emailVerified = true`, then creates the dealer link
 * (rejecting an already-linked user with 4106).
 *
 * @param input - Dealer id plus the new user's profile and plain password.
 * @returns The created assignment row with nested safe `user` fields.
 */
export async function createDealerWiseUserWithUser(
  input: CreateDealerWiseUserWithUserInput,
): Promise<DealerWiseUserWithUser> {
  await assertDealerExists(input.dealerId);
  const existingUser = await userRepository.findUserByEmail(input.emailId);
  if (existingUser) {
    throw new AppError('An account with this email already exists', StatusCodes.CONFLICT, 4091);
  }
  const hashedPassword = await hashPassword(input.password);
  const user = await userRepository.createUser({
    emailId: input.emailId,
    password: hashedPassword,
    userName: input.userName,
    mobileNo: input.mobileNo,
    gender: null,
    emailVerified: true,
  });
  const existingLink = await dealerWiseUserRepository.findDealerWiseUserByUserId(user.userId);
  if (existingLink) {
    throw new AppError('This user is already linked to a dealer', StatusCodes.CONFLICT, 4106);
  }
  return dealerWiseUserRepository.createDealerWiseUser({
    dealerId: input.dealerId,
    userId: user.userId,
  });
}

/**
 * Lists assignments for a dealer (no pagination).
 */
export async function listDealerWiseUsers(dealerId: string): Promise<DealerWiseUserWithUser[]> {
  await assertDealerExists(dealerId);
  return dealerWiseUserRepository.listDealerWiseUsersByDealerId(dealerId);
}

/**
 * Updates assignment; `userId` must stay globally unique in this table.
 */
export async function updateDealerWiseUser(
  dwuId: string,
  input: UpdateDealerWiseUserInput,
): Promise<DealerWiseUserWithUser> {
  const current = await dealerWiseUserRepository.findDealerWiseUserById(dwuId);
  if (!current) {
    throw new AppError('Dealer user assignment not found', StatusCodes.NOT_FOUND, 4053);
  }
  await assertUserExists(input.userId);
  if (input.userId !== current.userId) {
    const taken = await dealerWiseUserRepository.findDealerWiseUserByUserId(input.userId);
    if (taken && taken.dwuId !== dwuId) {
      throw new AppError(
        'This user is already linked to a dealer',
        StatusCodes.CONFLICT,
        4106,
      );
    }
  }
  return dealerWiseUserRepository.updateDealerWiseUser(dwuId, {
    userId: input.userId,
  });
}

/**
 * Deletes an assignment by `dwuId`.
 */
export async function deleteDealerWiseUser(dwuId: string): Promise<void> {
  await getDealerWiseUserById(dwuId);
  await dealerWiseUserRepository.deleteDealerWiseUser(dwuId);
}

/**
 * Returns the `dealerId` for the user’s single assignment, or `null`.
 */
export async function getPrimaryDealerIdForUser(userId: string): Promise<string | null> {
  return dealerWiseUserRepository.findFirstDealerIdByUserId(userId);
}
