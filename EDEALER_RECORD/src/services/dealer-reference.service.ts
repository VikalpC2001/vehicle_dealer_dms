import { StatusCodes } from 'http-status-codes';
import type { DealerReference } from '@prisma/client';
import * as dealerReferenceRepository from '../repositories/dealer-reference.repository';
import type { DealerReferenceDropdownItem } from '../repositories/dealer-reference.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';

/**
 * Input for creating a new dealer reference.
 * referenceName and referenceNumber are required and must be unique per dealer.
 */
export interface CreateDealerReferenceInput {
  dealerId: string;
  referenceName: string;
  referenceNumber: string;
}

/**
 * Input for updating a dealer reference.
 * referenceName and referenceNumber are required and must be unique per dealer (excluding current reference).
 */
export interface UpdateDealerReferenceInput {
  referenceName: string;
  referenceNumber: string;
}

/**
 * Creates a new dealer reference.
 * Throws if referenceName or referenceNumber already exists for the same dealer.
 */
export async function createDealerReference(
  input: CreateDealerReferenceInput,
): Promise<DealerReference> {
  const existingByName =
    await dealerReferenceRepository.findDealerReferenceByDealerAndName(
      input.dealerId,
      input.referenceName,
    );
  if (existingByName) {
    throw new AppError(
      'Reference name already exists for this dealer',
      StatusCodes.CONFLICT,
      4098,
    );
  }

  const existingByNumber =
    await dealerReferenceRepository.findDealerReferenceByDealerAndNumber(
      input.dealerId,
      input.referenceNumber,
    );
  if (existingByNumber) {
    throw new AppError(
      'Reference number already exists for this dealer',
      StatusCodes.CONFLICT,
      4099,
    );
  }

  return dealerReferenceRepository.createDealerReference(input);
}

/**
 * Returns a paginated list of dealer references for a specific dealer.
 */
export async function listDealerReferences(
  query: PaginationQuery & { dealerId: string },
): Promise<PaginatedResult<DealerReference>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await dealerReferenceRepository.listDealerReferences(
    skip,
    take,
    query.dealerId,
  );
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

/**
 * Returns all dealer references for a dealer (no pagination), for dropdown use.
 *
 * @param dealerId - Resolved dealer scope.
 */
export async function listDealerReferencesForDropdown(
  dealerId: string,
): Promise<DealerReferenceDropdownItem[]> {
  return dealerReferenceRepository.listDealerReferencesForDropdown(dealerId);
}

/**
 * Retrieves a single dealer reference by ID, or throws if not found.
 */
export async function getDealerReferenceById(
  referenceId: string,
): Promise<DealerReference> {
  const reference =
    await dealerReferenceRepository.findDealerReferenceById(referenceId);
  if (!reference) {
    throw new AppError(
      'Dealer reference not found',
      StatusCodes.NOT_FOUND,
      4046,
    );
  }
  return reference;
}

/**
 * Updates an existing dealer reference.
 * Throws if another reference for the same dealer has the same referenceName or referenceNumber.
 */
export async function updateDealerReference(
  referenceId: string,
  input: UpdateDealerReferenceInput,
): Promise<DealerReference> {
  const current = await getDealerReferenceById(referenceId);

  const existingByName =
    await dealerReferenceRepository.findDealerReferenceByDealerAndName(
      current.dealerId ?? '',
      input.referenceName,
      referenceId,
    );
  if (existingByName) {
    throw new AppError(
      'Reference name already exists for this dealer',
      StatusCodes.CONFLICT,
      4098,
    );
  }

  const existingByNumber =
    await dealerReferenceRepository.findDealerReferenceByDealerAndNumber(
      current.dealerId ?? '',
      input.referenceNumber,
      referenceId,
    );
  if (existingByNumber) {
    throw new AppError(
      'Reference number already exists for this dealer',
      StatusCodes.CONFLICT,
      4099,
    );
  }

  return dealerReferenceRepository.updateDealerReference(referenceId, input);
}

/**
 * Deletes a dealer reference by ID.
 */
export async function deleteDealerReference(
  referenceId: string,
): Promise<void> {
  await getDealerReferenceById(referenceId);
  await dealerReferenceRepository.deleteDealerReference(referenceId);
}

