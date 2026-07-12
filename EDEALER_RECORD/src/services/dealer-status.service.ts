import { StatusCodes } from 'http-status-codes';
import type { DealerStatus } from '@prisma/client';
import * as dealerStatusRepository from '../repositories/dealer-status.repository';
import { AppError } from '../utils/app-error';

/**
 * Input item for syncing dealer statuses.
 */
export interface DealerStatusSyncItem {
  statusId?: string;
  statusName: string;
  colour?: string;
}

/**
 * Input for syncing all statuses for a dealer.
 */
export interface SyncDealerStatusesInput {
  dealerId: string;
  statusData: DealerStatusSyncItem[];
}

/**
 * Input for updating statusRank for multiple statuses for a dealer.
 */
export interface UpdateDealerStatusOrderItem {
  statusId: string;
  statusRank: number;
}

export interface UpdateDealerStatusOrderInput {
  dealerId: string;
  items: UpdateDealerStatusOrderItem[];
}

/**
 * Syncs all statuses for a dealer based on the provided array.
 *
 * For the given dealerId:
 * - Updates existing statuses whose statusId appears in the payload (statusName, colour, statusRank).
 * - Creates new statuses for items without statusId.
 * - Deletes any existing statuses for that dealer that are not present in the payload.
 *
 * The order of the payload defines statusRank (1, 2, 3, ...).
 */
export async function syncDealerStatuses(
  input: SyncDealerStatusesInput,
): Promise<DealerStatus[]> {
  if (input.statusData.length === 0) {
    throw new AppError(
      'At least one status is required',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4221,
    );
  }

  // Basic uniqueness guard for statusName within the payload for this dealer.
  const names = input.statusData.map((s) => s.statusName);
  if (new Set(names).size !== names.length) {
    throw new AppError(
      'Duplicate statusName in payload for this dealer',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4222,
    );
  }

  return dealerStatusRepository.syncDealerStatusesForDealer(
    input.dealerId,
    input.statusData,
  );
}

/**
 * Returns all statuses for a dealer ordered by statusRank ascending.
 */
export async function getDealerStatusesByDealerId(
  dealerId: string,
): Promise<DealerStatus[]> {
  const { items } = await dealerStatusRepository.listDealerStatuses(
    0,
    Number.MAX_SAFE_INTEGER,
    dealerId,
  );
  return items;
}

/**
 * Updates statusRank for multiple statuses for a dealer.
 * Ensures all statusIds belong to the given dealer before updating.
 */
export async function updateDealerStatusOrder(
  input: UpdateDealerStatusOrderInput,
): Promise<DealerStatus[]> {
  if (input.items.length === 0) {
    throw new AppError(
      'At least one status is required',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4221,
    );
  }

  const current = await dealerStatusRepository.listDealerStatuses(
    0,
    Number.MAX_SAFE_INTEGER,
    input.dealerId,
  );
  const currentIds = new Set(current.items.map((s) => s.statusId));

  for (const item of input.items) {
    if (!currentIds.has(item.statusId)) {
      throw new AppError(
        'One or more statuses do not belong to this dealer',
        StatusCodes.UNPROCESSABLE_ENTITY,
        4223,
      );
    }
  }

  await dealerStatusRepository.updateStatusRanks(input.items);
  return getDealerStatusesByDealerId(input.dealerId);
}
