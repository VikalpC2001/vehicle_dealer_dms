import { StatusCodes } from 'http-status-codes';
import type { DealerTaskStatus } from '@prisma/client';
import * as dealerTaskStatusRepository from '../repositories/dealer-task-status.repository';
import { AppError } from '../utils/app-error';

/**
 * Input item for syncing dealer task statuses.
 */
export interface DealerTaskStatusSyncItem {
  statusId?: string;
  statusName: string;
  colour?: string;
  isDone?: boolean;
}

/**
 * Input for syncing all task statuses for a dealer.
 */
export interface SyncDealerTaskStatusesInput {
  dealerId: string;
  statusData: DealerTaskStatusSyncItem[];
}

/**
 * Input for updating statusRank for multiple task statuses for a dealer.
 */
export interface UpdateDealerTaskStatusOrderItem {
  statusId: string;
  statusRank: number;
}

export interface UpdateDealerTaskStatusOrderInput {
  dealerId: string;
  items: UpdateDealerTaskStatusOrderItem[];
}

/**
 * Syncs all task statuses for a dealer based on the provided array.
 *
 * For the given dealerId:
 * - Updates existing statuses whose statusId appears in the payload (statusName, colour, statusRank, isDone).
 * - Creates new statuses for items without statusId.
 * - Deletes any existing statuses for that dealer that are not present in the payload.
 *
 * The order of the payload defines statusRank (1, 2, 3, ...).
 */
export async function syncDealerTaskStatuses(
  input: SyncDealerTaskStatusesInput,
): Promise<DealerTaskStatus[]> {
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

  // At most ONE column may be the "Done" column. Normalize the payload (keep the first `isDone`,
  // clear the rest) so the invariant holds no matter what the client sends.
  let doneUsed = false;
  const statusData = input.statusData.map((s) => {
    const isDone = Boolean(s.isDone) && !doneUsed;
    if (isDone) doneUsed = true;
    return { ...s, isDone };
  });

  return dealerTaskStatusRepository.syncDealerTaskStatusesForDealer(
    input.dealerId,
    statusData,
  );
}

/**
 * Returns all task statuses for a dealer ordered by statusRank ascending.
 */
export async function getDealerTaskStatusesByDealerId(
  dealerId: string,
): Promise<DealerTaskStatus[]> {
  const { items } = await dealerTaskStatusRepository.listDealerTaskStatuses(
    0,
    Number.MAX_SAFE_INTEGER,
    dealerId,
  );
  return items;
}

/**
 * Updates statusRank for multiple task statuses for a dealer.
 * Ensures all statusIds belong to the given dealer before updating.
 */
export async function updateDealerTaskStatusOrder(
  input: UpdateDealerTaskStatusOrderInput,
): Promise<DealerTaskStatus[]> {
  if (input.items.length === 0) {
    throw new AppError(
      'At least one status is required',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4221,
    );
  }

  const current = await dealerTaskStatusRepository.listDealerTaskStatuses(
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

  await dealerTaskStatusRepository.updateDealerTaskStatusRanks(input.items);
  return getDealerTaskStatusesByDealerId(input.dealerId);
}
