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
    },
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
