import { StatusCodes } from 'http-status-codes';
import type { UploadCategory } from '@prisma/client';
import * as uploadCategoryRepository from '../repositories/upload-category.repository';
import { AppError } from '../utils/app-error';

/** Create input: `orderRank` is auto-assigned. */
export interface CreateUploadCategoryInput {
  categoryName: string;
  bothSide: boolean;
  processApi?: string | null;
}

/** Update input: full replace of mutable fields. */
export interface UpdateUploadCategoryInput {
  categoryName: string;
  bothSide: boolean;
  processApi?: string | null;
}

/** Trims a process API string; empty → null. */
const normalizeProcessApi = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
};

/**
 * Creates an upload category. `orderRank` is set to max existing + 1.
 */
export async function createUploadCategory(
  input: CreateUploadCategoryInput,
): Promise<UploadCategory> {
  const existing = await uploadCategoryRepository.findUploadCategoryByName(input.categoryName);
  if (existing) {
    throw new AppError('Category name already exists', StatusCodes.CONFLICT, 4097);
  }
  return uploadCategoryRepository.createUploadCategory({
    categoryName: input.categoryName,
    bothSide: input.bothSide,
    processApi: normalizeProcessApi(input.processApi),
  });
}

/**
 * All categories sorted by `orderRank` (no pagination).
 */
export async function listUploadCategories(): Promise<UploadCategory[]> {
  return uploadCategoryRepository.findAllUploadCategories();
}

/**
 * Fetches one category by id or throws 404.
 */
export async function getUploadCategoryById(categoryId: string): Promise<UploadCategory> {
  const row = await uploadCategoryRepository.findUploadCategoryById(categoryId);
  if (!row) {
    throw new AppError('Upload category not found', StatusCodes.NOT_FOUND, 4051);
  }
  return row;
}

/**
 * Updates category name (unique).
 */
export async function updateUploadCategory(
  categoryId: string,
  input: UpdateUploadCategoryInput,
): Promise<UploadCategory> {
  await getUploadCategoryById(categoryId);
  const taken = await uploadCategoryRepository.findUploadCategoryByName(
    input.categoryName,
    categoryId,
  );
  if (taken) {
    throw new AppError('Category name already exists', StatusCodes.CONFLICT, 4097);
  }
  return uploadCategoryRepository.updateUploadCategory(categoryId, {
    categoryName: input.categoryName,
    bothSide: input.bothSide,
    processApi: normalizeProcessApi(input.processApi),
  });
}

/**
 * Deletes a category by id.
 */
export async function deleteUploadCategory(categoryId: string): Promise<void> {
  await getUploadCategoryById(categoryId);
  await uploadCategoryRepository.deleteUploadCategory(categoryId);
}

/** Body item for PUT .../order (optional `categoryName` for client reference only). */
export interface UpdateUploadCategoryOrderRanksItem {
  categoryId: string;
  categoryName?: string;
  orderRank: number;
}

/**
 * Bulk-updates display order; all ids must exist.
 */
export async function updateUploadCategoryOrderRanks(
  items: UpdateUploadCategoryOrderRanksItem[],
): Promise<UploadCategory[]> {
  for (const item of items) {
    await getUploadCategoryById(item.categoryId);
  }
  return uploadCategoryRepository.updateUploadCategoryOrderRanks(
    items.map(({ categoryId, orderRank }) => ({ categoryId, orderRank })),
  );
}
