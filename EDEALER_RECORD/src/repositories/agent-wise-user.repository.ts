import { prisma } from '../config/prisma';
import type { Prisma } from '@prisma/client';

const userSelect = {
  userId: true,
  userName: true,
  emailId: true,
  mobileNo: true,
} as const;

/**
 * Explicit scalar list so queries never reference dropped columns if the Prisma Client is stale.
 */
const agentWiseUserWithUserSelect = {
  awuId: true,
  userId: true,
  agentId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userSelect },
} satisfies Prisma.AgentWiseUserSelect;

export type AgentWiseUserWithUser = Prisma.AgentWiseUserGetPayload<{
  select: typeof agentWiseUserWithUserSelect;
}>;

/** Fields required to create an agent-wise user row. */
export interface CreateAgentWiseUserData {
  userId: string;
  agentId: string;
}

/** Update mutable assignment: replace linked `userId` (still globally unique). */
export interface UpdateAgentWiseUserData {
  userId: string;
}

/**
 * Inserts an agent–user link.
 *
 * @param data - Foreign keys; `userId` must not already exist in this table (DB-enforced).
 * @returns Row with `user` (safe fields).
 */
export async function createAgentWiseUser(
  data: CreateAgentWiseUserData,
): Promise<AgentWiseUserWithUser> {
  return prisma.agentWiseUser.create({
    data: {
      userId: data.userId,
      agentId: data.agentId,
    },
    select: agentWiseUserWithUserSelect,
  });
}

/**
 * Lists all assignments for an agent, oldest first.
 *
 * @param agentId - Agent UUID.
 * @returns Rows with `user`.
 */
export async function listAgentWiseUsersByAgentId(
  agentId: string,
): Promise<AgentWiseUserWithUser[]> {
  return prisma.agentWiseUser.findMany({
    where: { agentId },
    orderBy: { createdAt: 'asc' },
    select: agentWiseUserWithUserSelect,
  });
}

/**
 * Finds a row by primary key with relations.
 *
 * @param awuId - Primary key (`awu_id`).
 * @returns Row or `null`.
 */
export async function findAgentWiseUserById(
  awuId: string,
): Promise<AgentWiseUserWithUser | null> {
  return prisma.agentWiseUser.findUnique({
    where: { awuId },
    select: agentWiseUserWithUserSelect,
  });
}

/**
 * Finds the assignment row for a `userId` (`userId` is unique in this table).
 *
 * @param userId - User UUID.
 * @returns PK only when a row exists, or `null`.
 */
export async function findAgentWiseUserByUserId(
  userId: string,
): Promise<{ awuId: string } | null> {
  return prisma.agentWiseUser.findUnique({
    where: { userId },
    select: { awuId: true },
  });
}

/**
 * Returns `agentId` for the user’s single assignment, or `null`.
 *
 * @param userId - User UUID.
 */
export async function findFirstAgentIdByUserId(userId: string): Promise<string | null> {
  const row = await prisma.agentWiseUser.findUnique({
    where: { userId },
    select: { agentId: true },
  });
  return row?.agentId ?? null;
}

/**
 * Updates `userId` for a row (must remain globally unique).
 *
 * @param awuId - Primary key.
 * @param data - New user reference.
 * @returns Updated row with relations.
 */
export async function updateAgentWiseUser(
  awuId: string,
  data: UpdateAgentWiseUserData,
): Promise<AgentWiseUserWithUser> {
  return prisma.agentWiseUser.update({
    where: { awuId },
    data: {
      userId: data.userId,
    },
    select: agentWiseUserWithUserSelect,
  });
}

/**
 * Deletes a row by id.
 *
 * @param awuId - Primary key.
 */
export async function deleteAgentWiseUser(awuId: string): Promise<void> {
  await prisma.agentWiseUser.delete({
    where: { awuId },
    select: { awuId: true },
  });
}

/**
 * Confirms an agent exists. Kept local to this slice (no dedicated agent repository)
 * so the service can validate the FK without depending on another agent-* slice.
 *
 * @param agentId - Agent UUID.
 * @returns PK only when the agent exists, or `null`.
 */
export async function findAgentById(agentId: string): Promise<{ agentId: string } | null> {
  return prisma.agent.findUnique({
    where: { agentId },
    select: { agentId: true },
  });
}
