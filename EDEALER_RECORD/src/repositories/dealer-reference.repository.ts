import { prisma } from '../config/prisma';
import type { DealerReference } from '@prisma/client';

/** Minimal fields for reference dropdown lists. */
export type DealerReferenceDropdownItem = Pick<
  DealerReference,
  'referenceId' | 'referenceName' | 'referenceNumber'
>;

/**
 * Data required to create a new dealer reference.
 * referenceName and referenceNumber are required; both must be unique per dealer.
 */
export interface CreateDealerReferenceData {
  dealerId: string;
  referenceName: string;
  referenceNumber: string;
}

/**
 * Data allowed when updating a dealer reference.
 * referenceName and referenceNumber are required; both must be unique per dealer (excluding current reference).
 */
export interface UpdateDealerReferenceData {
  referenceName: string;
  referenceNumber: string;
}

/**
 * Creates a new dealer reference.
 */
export async function createDealerReference(
  data: CreateDealerReferenceData,
): Promise<DealerReference> {
  return prisma.dealerReference.create({
    data,
  });
}

/**
 * Returns a paginated list of dealer references and total count.
 * Optionally filters by dealerId.
 */
export async function listDealerReferences(
  skip: number,
  take: number,
  dealerId?: string,
): Promise<{ items: DealerReference[]; total: number }> {
  const where = dealerId ? { dealerId } : {};
  const [items, total] = await Promise.all([
    prisma.dealerReference.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dealerReference.count({ where }),
  ]);
  return { items, total };
}

/**
 * Lists all dealer references for a dealer (no pagination), for dropdown use.
 *
 * @param dealerId - Dealer scope.
 */
export async function listDealerReferencesForDropdown(
  dealerId: string,
): Promise<DealerReferenceDropdownItem[]> {
  return prisma.dealerReference.findMany({
    where: { dealerId },
    select: {
      referenceId: true,
      referenceName: true,
      referenceNumber: true,
    },
    orderBy: { referenceName: 'asc' },
  });
}

/**
 * Finds a single dealer reference by ID.
 */
export async function findDealerReferenceById(
  referenceId: string,
): Promise<DealerReference | null> {
  return prisma.dealerReference.findUnique({
    where: { referenceId },
  });
}

/**
 * Finds a dealer reference by dealerId and referenceName.
 * Optionally exclude a referenceId (for update uniqueness check).
 */
export async function findDealerReferenceByDealerAndName(
  dealerId: string,
  referenceName: string,
  excludeReferenceId?: string,
): Promise<DealerReference | null> {
  return prisma.dealerReference.findFirst({
    where: {
      dealerId,
      referenceName,
      ...(excludeReferenceId && { referenceId: { not: excludeReferenceId } }),
    },
  });
}

/**
 * Finds a dealer reference by dealerId and referenceNumber.
 * Optionally exclude a referenceId (for update uniqueness check).
 */
export async function findDealerReferenceByDealerAndNumber(
  dealerId: string,
  referenceNumber: string,
  excludeReferenceId?: string,
): Promise<DealerReference | null> {
  return prisma.dealerReference.findFirst({
    where: {
      dealerId,
      referenceNumber,
      ...(excludeReferenceId && { referenceId: { not: excludeReferenceId } }),
    },
  });
}

/**
 * Updates an existing dealer reference.
 */
export async function updateDealerReference(
  referenceId: string,
  data: UpdateDealerReferenceData,
): Promise<DealerReference> {
  return prisma.dealerReference.update({
    where: { referenceId },
    data,
  });
}

/**
 * Deletes a dealer reference by ID.
 */
export async function deleteDealerReference(
  referenceId: string,
): Promise<DealerReference> {
  return prisma.dealerReference.delete({
    where: { referenceId },
  });
}

