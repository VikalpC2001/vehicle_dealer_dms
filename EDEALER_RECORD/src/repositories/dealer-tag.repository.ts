import { prisma } from '../config/prisma';
import type { DealerTag } from '@prisma/client';

/**
 * Data required to create a new dealer tag. dealerId and tagName are required; tagName is unique per
 * dealer (`@@unique([dealerId, tagName])`); colour is an optional label swatch.
 */
export interface CreateDealerTagData {
  dealerId: string;
  tagName: string;
  colour?: string | null;
}

/**
 * Data allowed when updating a dealer tag. Both fields are optional; only the provided ones are
 * written. tagName must stay unique within the same dealer.
 */
export interface UpdateDealerTagData {
  tagName?: string;
  colour?: string | null;
}

/**
 * Creates a new dealer tag. A duplicate (dealerId, tagName) raises Prisma P2002, mapped to 409 by the
 * global error handler.
 */
export async function createDealerTag(data: CreateDealerTagData): Promise<DealerTag> {
  return prisma.dealerTag.create({
    data: {
      dealerId: data.dealerId,
      tagName: data.tagName,
      colour: data.colour ?? null,
    },
  });
}

/**
 * Returns all tags for a dealer, ordered by tagName ascending.
 */
export async function listDealerTags(dealerId: string): Promise<DealerTag[]> {
  return prisma.dealerTag.findMany({
    where: { dealerId },
    orderBy: { tagName: 'asc' },
  });
}

/**
 * Finds a single dealer tag by ID.
 */
export async function findDealerTagById(tagId: string): Promise<DealerTag | null> {
  return prisma.dealerTag.findUnique({
    where: { tagId },
  });
}

/**
 * Counts how many of the given tagIds belong to the dealer. Used to verify every tag on a
 * set-process-tags request is owned by the resolved dealer before writing the join rows.
 */
export async function countDealerTagsByIds(dealerId: string, tagIds: string[]): Promise<number> {
  return prisma.dealerTag.count({
    where: { dealerId, tagId: { in: tagIds } },
  });
}

/**
 * Updates an existing dealer tag (tagName and/or colour; dealerId cannot be changed). A duplicate
 * (dealerId, tagName) raises Prisma P2002, mapped to 409 by the global error handler.
 */
export async function updateDealerTag(
  tagId: string,
  data: UpdateDealerTagData,
): Promise<DealerTag> {
  return prisma.dealerTag.update({
    where: { tagId },
    data: {
      ...(data.tagName !== undefined && { tagName: data.tagName }),
      ...(data.colour !== undefined && { colour: data.colour }),
    },
  });
}

/**
 * Deletes a dealer tag by ID. Its ProcessTag join rows cascade automatically.
 */
export async function deleteDealerTag(tagId: string): Promise<DealerTag> {
  return prisma.dealerTag.delete({
    where: { tagId },
  });
}
