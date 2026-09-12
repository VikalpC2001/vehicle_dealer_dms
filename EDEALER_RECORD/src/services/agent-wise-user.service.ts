import { StatusCodes } from 'http-status-codes';
import * as agentWiseUserRepository from '../repositories/agent-wise-user.repository';
import type { AgentWiseUserWithUser } from '../repositories/agent-wise-user.repository';
import { findDealerWiseUserByUserId } from '../repositories/dealer-wise-user.repository';
import * as userRepository from '../repositories/user.repository';
import { hashPassword } from './password-auth.service';
import { AppError } from '../utils/app-error';

export interface CreateAgentWiseUserInput {
  agentId: string;
  userId: string;
}

export interface UpdateAgentWiseUserInput {
  userId: string;
}

export interface CreateAgentWiseUserWithUserInput {
  agentId: string;
  userName: string;
  emailId: string;
  mobileNo: string;
  password: string;
  /** Defaults true (admin-created logins skip OTP). Self-registration passes false → verify via OTP. */
  emailVerified?: boolean;
}

/**
 * Ensures the agent exists.
 */
const assertAgentExists = async (agentId: string): Promise<void> => {
  const agent = await agentWiseUserRepository.findAgentById(agentId);
  if (!agent) {
    throw new AppError('Agent not found', StatusCodes.NOT_FOUND, 4044);
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
 * Returns an agent-wise user row or throws 404.
 */
export async function getAgentWiseUserById(awuId: string): Promise<AgentWiseUserWithUser> {
  const row = await agentWiseUserRepository.findAgentWiseUserById(awuId);
  if (!row) {
    throw new AppError('Agent user assignment not found', StatusCodes.NOT_FOUND, 4053);
  }
  return row;
}

/**
 * Creates an assignment; each `userId` may appear at most once in the table (one agent only).
 * Enforces the cross-persona rule: a user already linked to a dealer cannot be linked to an agent.
 */
export async function createAgentWiseUser(
  input: CreateAgentWiseUserInput,
): Promise<AgentWiseUserWithUser> {
  await assertAgentExists(input.agentId);
  await assertUserExists(input.userId);
  const existing = await agentWiseUserRepository.findAgentWiseUserByUserId(input.userId);
  if (existing) {
    throw new AppError(
      'This user is already linked to an agent',
      StatusCodes.CONFLICT,
      4106,
    );
  }
  const existingDealerLink = await findDealerWiseUserByUserId(input.userId);
  if (existingDealerLink) {
    throw new AppError(
      'This user is already linked to a dealer',
      StatusCodes.CONFLICT,
      4097,
    );
  }
  return agentWiseUserRepository.createAgentWiseUser({
    agentId: input.agentId,
    userId: input.userId,
  });
}

/**
 * Creates a brand-new verified user and links them to the agent in one step.
 * Validates the agent, rejects a duplicate email (4091), hashes the password,
 * creates the user with `emailVerified = true`, then creates the agent link
 * (rejecting an already-linked user with 4106). The globally-unique `User.emailId`
 * also covers the cross-persona case (a dealer user reusing the email is rejected at 4091).
 *
 * @param input - Agent id plus the new user's profile and plain password.
 * @returns The created assignment row with nested safe `user` fields.
 */
export async function createAgentWiseUserWithUser(
  input: CreateAgentWiseUserWithUserInput,
): Promise<AgentWiseUserWithUser> {
  await assertAgentExists(input.agentId);
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
    emailVerified: input.emailVerified ?? true,
  });
  const existingLink = await agentWiseUserRepository.findAgentWiseUserByUserId(user.userId);
  if (existingLink) {
    throw new AppError('This user is already linked to an agent', StatusCodes.CONFLICT, 4106);
  }
  return agentWiseUserRepository.createAgentWiseUser({
    agentId: input.agentId,
    userId: user.userId,
  });
}

/**
 * Lists assignments for an agent (no pagination).
 */
export async function listAgentWiseUsers(agentId: string): Promise<AgentWiseUserWithUser[]> {
  await assertAgentExists(agentId);
  return agentWiseUserRepository.listAgentWiseUsersByAgentId(agentId);
}

/**
 * Updates assignment; `userId` must stay globally unique in this table.
 */
export async function updateAgentWiseUser(
  awuId: string,
  input: UpdateAgentWiseUserInput,
): Promise<AgentWiseUserWithUser> {
  const current = await agentWiseUserRepository.findAgentWiseUserById(awuId);
  if (!current) {
    throw new AppError('Agent user assignment not found', StatusCodes.NOT_FOUND, 4053);
  }
  await assertUserExists(input.userId);
  if (input.userId !== current.userId) {
    const taken = await agentWiseUserRepository.findAgentWiseUserByUserId(input.userId);
    if (taken && taken.awuId !== awuId) {
      throw new AppError(
        'This user is already linked to an agent',
        StatusCodes.CONFLICT,
        4106,
      );
    }
  }
  return agentWiseUserRepository.updateAgentWiseUser(awuId, {
    userId: input.userId,
  });
}

/**
 * Deletes an assignment by `awuId`.
 */
export async function deleteAgentWiseUser(awuId: string): Promise<void> {
  await getAgentWiseUserById(awuId);
  await agentWiseUserRepository.deleteAgentWiseUser(awuId);
}

/**
 * Returns the `agentId` for the user’s single assignment, or `null`.
 */
export async function getPrimaryAgentIdForUser(userId: string): Promise<string | null> {
  return agentWiseUserRepository.findFirstAgentIdByUserId(userId);
}
