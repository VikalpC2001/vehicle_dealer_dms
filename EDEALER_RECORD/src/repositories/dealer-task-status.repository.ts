import { prisma } from '../config/prisma';
import type { DealerTaskStatus } from '@prisma/client';

/**
 * Data required to create a new dealer task status. dealerId and statusName are required; statusName is unique per dealer; statusRank is assigned per dealer.
 */
export interface CreateDealerTaskStatusData {
  dealerId: string;
  statusName: string;
  colour?: string;
  isDone?: boolean;
}

/**
 * Data allowed when updating a dealer task status. statusName must be unique within the same dealer (excluding current status).
 */
export interface UpdateDealerTaskStatusData {
  statusName: string;
  colour?: string;
  isDone?: boolean;
}

/**
 * Creates a new dealer task status for the given dealer. Assigns the next sequential statusRank for that dealer.
 */
export async function createDealerTaskStatus(
  data: CreateDealerTaskStatusData,
): Promise<DealerTaskStatus> {
  return prisma.$transaction(async (tx) => {
    const lastStatus = await tx.dealerTaskStatus.findFirst({
      where: { dealerId: data.dealerId },
      orderBy: { statusRank: 'desc' },
      select: { statusRank: true },
    });
    const nextRank = (lastStatus?.statusRank ?? 0) + 1;
    return tx.dealerTaskStatus.create({
      data: {
        dealerId: data.dealerId,
        statusName: data.statusName,
        colour: data.colour ?? null,
        statusRank: nextRank,
        isDone: data.isDone ?? false,
      },
    });
  });
}

/**
 * Returns a paginated list of dealer task statuses. When dealerId is provided, filters by dealer and orders by statusRank ascending.
 */
export async function listDealerTaskStatuses(
  skip: number,
  take: number,
  dealerId?: string,
): Promise<{ items: DealerTaskStatus[]; total: number }> {
  const where = dealerId ? { dealerId } : {};
  const [items, total] = await Promise.all([
    prisma.dealerTaskStatus.findMany({
      where,
      skip,
      take,
      orderBy: [{ dealerId: 'asc' }, { statusRank: 'asc' }],
    }),
    prisma.dealerTaskStatus.count({ where }),
  ]);
  return { items, total };
}

/**
 * Synchronises all task statuses for a dealer in a single transaction.
 *
 * For the given dealerId:
 * - Updates existing statuses whose statusId appears in the payload (statusName, colour, statusRank, isDone).
 * - Creates new statuses for items without statusId.
 * - Deletes any existing statuses for that dealer that are not present in the payload.
 *
 * The order of the payload defines statusRank (1, 2, 3, ...).
 */
export async function syncDealerTaskStatusesForDealer(
  dealerId: string,
  items: Array<{
    statusId?: string;
    statusName: string;
    colour?: string;
    isDone?: boolean;
  }>,
): Promise<DealerTaskStatus[]> {
  return prisma.$transaction(async (tx) => {
    // Fetch current statuses for this dealer
    const existing = await tx.dealerTaskStatus.findMany({
      where: { dealerId },
      orderBy: { statusRank: 'asc' },
    });

    const existingById = new Map(existing.map((s) => [s.statusId, s]));
    const incomingIds = new Set<string>();
    const results: DealerTaskStatus[] = [];

    // Upsert and order
    for (let index = 0; index < items.length; index += 1) {
      const { statusId, statusName, colour, isDone } = items[index];
      const statusRank = index + 1;

      if (statusId && existingById.has(statusId)) {
        incomingIds.add(statusId);
        const updated = await tx.dealerTaskStatus.update({
          where: { statusId },
          data: { statusName, colour: colour ?? null, statusRank, isDone: isDone ?? false },
        });
        results.push(updated);
      } else {
        const created = await tx.dealerTaskStatus.create({
          data: {
            dealerId,
            statusName,
            colour: colour ?? null,
            statusRank,
            isDone: isDone ?? false,
          },
        });
        incomingIds.add(created.statusId);
        results.push(created);
      }
    }

    // Delete statuses that are not in the incoming list
    const toDelete = existing.filter((s) => !incomingIds.has(s.statusId));
    if (toDelete.length > 0) {
      await tx.dealerTaskStatus.deleteMany({
        where: {
          dealerId,
          statusId: { in: toDelete.map((s) => s.statusId) },
        },
      });
    }

    // Return the final ordered list
    return results.sort((a, b) => a.statusRank - b.statusRank);
  });
}

/**
 * Finds a single dealer task status by ID.
 */
export async function findDealerTaskStatusById(
  statusId: string,
): Promise<DealerTaskStatus | null> {
  return prisma.dealerTaskStatus.findUnique({
    where: { statusId },
  });
}

/**
 * Finds a dealer task status by dealerId and statusName. Optionally exclude a status ID (for update uniqueness check).
 */
export async function findDealerTaskStatusByDealerIdAndStatusName(
  dealerId: string,
  statusName: string,
  excludeStatusId?: string,
): Promise<DealerTaskStatus | null> {
  return prisma.dealerTaskStatus.findFirst({
    where: {
      dealerId,
      statusName,
      ...(excludeStatusId && { statusId: { not: excludeStatusId } }),
    },
  });
}

/**
 * Reports whether a status name is a terminal ("done") task-board column for the given dealer.
 * Matches on the dealer-scoped { dealerId, statusName } with isDone = true. Returns false when the
 * dealer has no such column configured (e.g. a managed placeholder dealer with no board set up).
 */
export async function isDoneStatus(dealerId: string, statusName: string): Promise<boolean> {
  const row = await prisma.dealerTaskStatus.findFirst({
    where: { dealerId, statusName, isDone: true },
    select: { statusId: true },
  });
  return row !== null;
}

/**
 * Updates an existing dealer task status (statusName, colour, and isDone only; dealerId cannot be changed).
 */
export async function updateDealerTaskStatus(
  statusId: string,
  data: UpdateDealerTaskStatusData,
): Promise<DealerTaskStatus> {
  return prisma.dealerTaskStatus.update({
    where: { statusId },
    data: {
      statusName: data.statusName,
      ...(data.colour !== undefined && { colour: data.colour }),
      ...(data.isDone !== undefined && { isDone: data.isDone }),
    },
  });
}

/**
 * Deletes a dealer task status by ID.
 */
export async function deleteDealerTaskStatus(
  statusId: string,
): Promise<DealerTaskStatus> {
  return prisma.dealerTaskStatus.delete({
    where: { statusId },
  });
}

/**
 * Item for bulk statusRank update. Only statusRank is updated.
 */
export interface UpdateDealerTaskStatusRankItem {
  statusId: string;
  statusRank: number;
}

/**
 * Updates statusRank for multiple dealer task statuses in one transaction. Returns updated records in request order.
 */
export async function updateDealerTaskStatusRanks(
  items: UpdateDealerTaskStatusRankItem[],
): Promise<DealerTaskStatus[]> {
  return prisma.$transaction(async (tx) => {
    const results: DealerTaskStatus[] = [];
    for (const { statusId, statusRank } of items) {
      const updated = await tx.dealerTaskStatus.update({
        where: { statusId },
        data: { statusRank },
      });
      results.push(updated);
    }
    return results;
  });
}
