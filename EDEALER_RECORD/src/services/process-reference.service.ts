import { StatusCodes } from 'http-status-codes';
import type { ReferenceType } from '@prisma/client';
import * as dealerReferenceRepository from '../repositories/dealer-reference.repository';
import { AppError } from '../utils/app-error';

/** Input for linking a dealer reference to a process at start time. */
export interface StartProcessReferenceInput {
  referenceId: string;
  referenceType: ReferenceType;
}

/**
 * Ensures each dealer reference exists and belongs to the given dealer (when scoped).
 *
 * @param dealerId - Dealer starting the process.
 * @param items - Reference links to validate.
 */
export const assertDealerReferencesForProcessStart = async (
  dealerId: string,
  items: StartProcessReferenceInput[],
): Promise<void> => {
  if (items.length === 0) {
    return;
  }

  const seenTypes = new Set<ReferenceType>();
  for (const item of items) {
    if (seenTypes.has(item.referenceType)) {
      throw new AppError(
        `Duplicate process reference type: ${item.referenceType}`,
        StatusCodes.UNPROCESSABLE_ENTITY,
        4228,
      );
    }
    seenTypes.add(item.referenceType);

    const reference = await dealerReferenceRepository.findDealerReferenceById(item.referenceId);
    if (!reference) {
      throw new AppError('Dealer reference not found', StatusCodes.NOT_FOUND, 4057);
    }
    if (reference.dealerId && reference.dealerId !== dealerId) {
      throw new AppError(
        'Dealer reference does not belong to this dealer',
        StatusCodes.FORBIDDEN,
        4035,
      );
    }
  }
};
