import { StatusCodes } from 'http-status-codes';
import type { DealerTag } from '@prisma/client';
import * as dealerTagRepository from '../repositories/dealer-tag.repository';
import { AppError } from '../utils/app-error';

/**
 * Input for creating a new dealer tag. tagName is required and unique per dealer.
 */
export interface CreateDealerTagInput {
  dealerId: string;
  tagName: string;
  colour?: string | null;
}

/**
 * Input for updating a dealer tag. Both fields are optional; only the provided ones are written.
 */
export interface UpdateDealerTagInput {
  tagName?: string;
  colour?: string | null;
}

/**
 * Normalizes an incoming colour: an empty/whitespace string becomes `null` (so a colour can be
 * cleared), a real value is trimmed, and `undefined` is left as-is (repository skips it on update).
 */
function normalizeColour(colour?: string | null): string | null | undefined {
  if (colour === undefined) return undefined;
  const trimmed = colour?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Creates a new dealer tag. A duplicate (dealerId, tagName) surfaces as Prisma P2002, which the
 * global error handler maps to 409 (4090).
 */
export async function createDealerTag(input: CreateDealerTagInput): Promise<DealerTag> {
  return dealerTagRepository.createDealerTag({ ...input, colour: normalizeColour(input.colour) });
}

/**
 * Returns all tags for a dealer, ordered by tagName ascending.
 */
export async function listDealerTags(dealerId: string): Promise<DealerTag[]> {
  return dealerTagRepository.listDealerTags(dealerId);
}

/**
 * Retrieves a single dealer tag by ID, or throws if not found.
 *
 * @throws AppError 404 (4069) when no tag exists for the ID.
 */
export async function getDealerTagById(tagId: string): Promise<DealerTag> {
  const tag = await dealerTagRepository.findDealerTagById(tagId);
  if (!tag) {
    throw new AppError('Dealer tag not found', StatusCodes.NOT_FOUND, 4069);
  }
  return tag;
}

/**
 * Updates an existing dealer tag. A duplicate (dealerId, tagName) surfaces as Prisma P2002, which the
 * global error handler maps to 409 (4090). Tenancy is enforced by the controller before this call.
 */
export async function updateDealerTag(
  tagId: string,
  input: UpdateDealerTagInput,
): Promise<DealerTag> {
  return dealerTagRepository.updateDealerTag(tagId, { ...input, colour: normalizeColour(input.colour) });
}

/**
 * Deletes a dealer tag by ID. Its ProcessTag join rows cascade automatically. Tenancy is enforced by
 * the controller before this call.
 */
export async function deleteDealerTag(tagId: string): Promise<void> {
  await dealerTagRepository.deleteDealerTag(tagId);
}
