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
const dealerWiseUserWithUserSelect = {
  dwuId: true,
  userId: true,
  dealerId: true,
  isOwner: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userSelect },
} satisfies Prisma.DealerWiseUserSelect;

export type DealerWiseUserWithUser = Prisma.DealerWiseUserGetPayload<{
  select: typeof dealerWiseUserWithUserSelect;
}>;

/** Fields required to create a dealer-wise user row. */
export interface CreateDealerWiseUserData {
  userId: string;
  dealerId: string;
  /** Marks the registering-dealership account as OWNER (full access). Defaults false for employees. */
  isOwner?: boolean;
}

/**
 * Auth-relevant slice of a dealer-wise user, used by the access-token claim and the per-request
 * capability resolver. Includes the assigned role's capability keys (if any).
 */
export interface DealerWiseUserAuth {
  dwuId: string;
  dealerId: string;
  isOwner: boolean;
  roleId: string | null;
  role: { capabilities: string[] } | null;
}

/** Update mutable assignment: replace linked `userId` (still globally unique). */
export interface UpdateDealerWiseUserData {
  userId: string;
}

/**
 * Inserts a dealer–user link.
 *
 * @param data - Foreign keys; `userId` must not already exist in this table (DB-enforced).
 * @returns Row with `user` (safe fields).
 */
export async function createDealerWiseUser(
  data: CreateDealerWiseUserData,
): Promise<DealerWiseUserWithUser> {
  return prisma.dealerWiseUser.create({
    data: {
      userId: data.userId,
      dealerId: data.dealerId,
      isOwner: data.isOwner ?? false,
    },
    select: dealerWiseUserWithUserSelect,
  });
}

/**
 * Loads the auth slice (owner flag, assigned role + its capabilities) for a user's dealer link.
 *
 * @param userId - User UUID (unique in this table).
 * @returns The auth slice, or `null` when the user is not linked to a dealer.
 */
export async function findDealerWiseUserAuthByUserId(
  userId: string,
): Promise<DealerWiseUserAuth | null> {
  return prisma.dealerWiseUser.findUnique({
    where: { userId },
    select: {
      dwuId: true,
      dealerId: true,
      isOwner: true,
      roleId: true,
      role: { select: { capabilities: true } },
    },
  });
}

/**
 * Sets (or clears) the role assigned to a dealer-wise user. Passing `null` clears the role,
 * dropping the employee to the read-only default.
 *
 * @param dwuId - Primary key of the dealer-wise user row.
 * @param roleId - Target `DealerRole` id, or `null` to clear.
 */
export async function updateDealerWiseUserRole(
  dwuId: string,
  roleId: string | null,
): Promise<DealerWiseUserWithUser> {
  return prisma.dealerWiseUser.update({
    where: { dwuId },
    data: { roleId },
    select: dealerWiseUserWithUserSelect,
  });
}

/**
 * Lists all assignments for a dealer, oldest first.
 *
 * @param dealerId - Dealer UUID.
 * @returns Rows with `user`.
 */
export async function listDealerWiseUsersByDealerId(
  dealerId: string,
): Promise<DealerWiseUserWithUser[]> {
  return prisma.dealerWiseUser.findMany({
    where: { dealerId },
    orderBy: { createdAt: 'asc' },
    select: dealerWiseUserWithUserSelect,
  });
}

/**
 * Finds a row by primary key with relations.
 *
 * @param dwuId - Primary key (`dwu_id`).
 * @returns Row or `null`.
 */
export async function findDealerWiseUserById(
  dwuId: string,
): Promise<DealerWiseUserWithUser | null> {
  return prisma.dealerWiseUser.findUnique({
    where: { dwuId },
    select: dealerWiseUserWithUserSelect,
  });
}

/**
 * Finds the assignment row for a `userId` (`userId` is unique in this table).
 *
 * @param userId - User UUID.
 * @returns PK only when a row exists, or `null`.
 */
export async function findDealerWiseUserByUserId(
  userId: string,
): Promise<{ dwuId: string } | null> {
  return prisma.dealerWiseUser.findUnique({
    where: { userId },
    select: { dwuId: true },
  });
}

/**
 * Returns `dealerId` for the user’s single assignment, or `null`.
 *
 * @param userId - User UUID.
 */
export async function findFirstDealerIdByUserId(userId: string): Promise<string | null> {
  const row = await prisma.dealerWiseUser.findUnique({
    where: { userId },
    select: { dealerId: true },
  });
  return row?.dealerId ?? null;
}

/**
 * Updates `userId` for a row (must remain globally unique).
 *
 * @param dwuId - Primary key.
 * @param data - New user reference.
 * @returns Updated row with relations.
 */
export async function updateDealerWiseUser(
  dwuId: string,
  data: UpdateDealerWiseUserData,
): Promise<DealerWiseUserWithUser> {
  return prisma.dealerWiseUser.update({
    where: { dwuId },
    data: {
      userId: data.userId,
    },
    select: dealerWiseUserWithUserSelect,
  });
}

/**
 * Deletes a row by id.
 *
 * @param dwuId - Primary key.
 */
export async function deleteDealerWiseUser(dwuId: string): Promise<void> {
  await prisma.dealerWiseUser.delete({
    where: { dwuId },
    select: { dwuId: true },
  });
}
