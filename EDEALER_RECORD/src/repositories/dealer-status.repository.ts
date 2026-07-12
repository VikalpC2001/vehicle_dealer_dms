import { prisma } from '../config/prisma';
import type { DealerStatus } from '@prisma/client';

/**
 * Data required to create a new dealer status. dealerId and statusName are required; statusName is unique per dealer; statusRank is assigned per dealer.
 */
export interface CreateDealerStatusData {
  dealerId: string;
  statusName: string;
  colour?: string;
}

/**
 * Data allowed when updating a dealer status. statusName must be unique within the same dealer (excluding current status).
 */
export interface UpdateDealerStatusData {
  statusName: string;
  colour?: string;
}

/**
 * Creates a new dealer status for the given dealer. Assigns the next sequential statusRank for that dealer.
 */
export async function createDealerStatus(
  data: CreateDealerStatusData,
): Promise<DealerStatus> {
  return prisma.$transaction(async (tx) => {
    const lastStatus = await tx.dealerStatus.findFirst({
      where: { dealerId: data.dealerId },
      orderBy: { statusRank: 'desc' },
      select: { statusRank: true },
    });
    const nextRank = (lastStatus?.statusRank ?? 0) + 1;
    return tx.dealerStatus.create({
      data: {
        dealerId: data.dealerId,
        statusName: data.statusName,
        colour: data.colour ?? null,
        statusRank: nextRank,
      },
    });
  });
}

/**
 * Returns a paginated list of dealer statuses. When dealerId is provided, filters by dealer and orders by statusRank ascending.
 */
export async function listDealerStatuses(
  skip: number,
  take: number,
  dealerId?: string,
): Promise<{ items: DealerStatus[]; total: number }> {
  const where = dealerId ? { dealerId } : {};
  const [items, total] = await Promise.all([
    prisma.dealerStatus.findMany({
      where,
      skip,
      take,
      orderBy: [{ dealerId: 'asc' }, { statusRank: 'asc' }],
    }),
    prisma.dealerStatus.count({ where }),
  ]);
  return { items, total };
}

/**
 * Synchronises all statuses for a dealer in a single transaction.
 *
 * For the given dealerId:
 * - Updates existing statuses whose statusId appears in the payload (statusName, colour, statusRank).
 * - Creates new statuses for items without statusId.
 * - Deletes any existing statuses for that dealer that are not present in the payload.
 *
 * The order of the payload defines statusRank (1, 2, 3, ...).
 */
export async function syncDealerStatusesForDealer(
  dealerId: string,
  items: Array<{ statusId?: string; statusName: string; colour?: string }>,
): Promise<DealerStatus[]> {
  return prisma.$transaction(async (tx) => {
    // Fetch current statuses for this dealer
    const existing = await tx.dealerStatus.findMany({
      where: { dealerId },
      orderBy: { statusRank: 'asc' },
    });

    const existingById = new Map(existing.map((s) => [s.statusId, s]));
    const incomingIds = new Set<string>();
    const results: DealerStatus[] = [];

    // Upsert and order
    for (let index = 0; index < items.length; index += 1) {
      const { statusId, statusName, colour } = items[index];
      const statusRank = index + 1;

      if (statusId && existingById.has(statusId)) {
        incomingIds.add(statusId);
        const updated = await tx.dealerStatus.update({
          where: { statusId },
          data: { statusName, colour: colour ?? null, statusRank },
        });
        results.push(updated);
      } else {
        const created = await tx.dealerStatus.create({
          data: {
            dealerId,
            statusName,
            colour: colour ?? null,
            statusRank,
          },
        });
        incomingIds.add(created.statusId);
        results.push(created);
      }
    }

    // Delete statuses that are not in the incoming list
    const toDelete = existing.filter((s) => !incomingIds.has(s.statusId));
    if (toDelete.length > 0) {
      await tx.dealerStatus.deleteMany({
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
 * Finds a single dealer status by ID.
 */
export async function findDealerStatusById(
  statusId: string,
): Promise<DealerStatus | null> {
  return prisma.dealerStatus.findUnique({
    where: { statusId },
  });
}

/**
 * Finds a dealer status by dealerId and statusName. Optionally exclude a status ID (for update uniqueness check).
 */
export async function findDealerStatusByDealerIdAndStatusName(
  dealerId: string,
  statusName: string,
  excludeStatusId?: string,
): Promise<DealerStatus | null> {
  return prisma.dealerStatus.findFirst({
    where: {
      dealerId,
      statusName,
      ...(excludeStatusId && { statusId: { not: excludeStatusId } }),
    },
  });
}

/**
 * Updates an existing dealer status (statusName and colour only; dealerId cannot be changed).
 */
export async function updateDealerStatus(
  statusId: string,
  data: UpdateDealerStatusData,
): Promise<DealerStatus> {
  return prisma.dealerStatus.update({
    where: { statusId },
    data: {
      statusName: data.statusName,
      ...(data.colour !== undefined && { colour: data.colour }),
    },
  });
}

/**
 * Deletes a dealer status by ID.
 */
export async function deleteDealerStatus(
  statusId: string,
): Promise<DealerStatus> {
  return prisma.dealerStatus.delete({
    where: { statusId },
  });
}

/**
 * Item for bulk statusRank update. Only statusRank is updated.
 */
export interface UpdateStatusRankItem {
  statusId: string;
  statusRank: number;
}

/**
 * Updates statusRank for multiple dealer statuses in one transaction. Returns updated records in request order.
 */
export async function updateStatusRanks(
  items: UpdateStatusRankItem[],
): Promise<DealerStatus[]> {
  return prisma.$transaction(async (tx) => {
    const results: DealerStatus[] = [];
    for (const { statusId, statusRank } of items) {
      const updated = await tx.dealerStatus.update({
        where: { statusId },
        data: { statusRank },
      });
      results.push(updated);
    }
    return results;
  });
}
