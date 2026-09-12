import { StatusCodes } from 'http-status-codes';
import * as dealerRepository from '../repositories/dealer.repository';
import * as dealerWiseUploadCategoryRepository from '../repositories/dealer-wise-upload-category.repository';
import type {
  DealerWiseUploadCategoryWithCategory,
  UpdateDealerWiseOrderRankItem,
} from '../repositories/dealer-wise-upload-category.repository';
import { AppError } from '../utils/app-error';
import { getUploadCategoryById } from './upload-category.service';

export interface CreateDealerWiseUploadCategoryInput {
  dealerId: string;
  uploadCategoryId: string;
  processApi?: string | null;
  isRequired: boolean;
  isProcess: boolean;
  isViewInStep: boolean;
}

export interface UpdateDealerWiseUploadCategoryInput {
  uploadCategoryId: string;
  processApi?: string | null;
  isRequired: boolean;
  isProcess: boolean;
  isViewInStep: boolean;
}

export interface UpdateDealerWiseUploadOrderRanksInput {
  dealerId: string;
  items: UpdateDealerWiseOrderRankItem[];
}

/**
 * API shape for a dealer-wise link: `dwucId`, `dealerId`, and a nested `uploadCategory`
 * that merges global name/id with per-dealer rank, flags, and `processApi`.
 */
export interface DealerWiseUploadCategoryResponseDto {
  dwucId: string;
  dealerId: string;
  uploadCategory: {
    categoryId: string;
    categoryName: string;
    orderRank: number;
    isRequired: boolean;
    processApi: string | null;
    isProcess: boolean;
    isViewInStep: boolean;
  };
}

/**
 * One entry inside `uploadCategory` for list/order responses (`GET ?dealerId=` and `PUT .../order`).
 */
export interface DealerWiseUploadCategoryListEntryDto {
  dwucId: string;
  categoryId: string;
  categoryName: string;
  orderRank: number;
  isRequired: boolean;
  processApi: string | null;
  isProcess: boolean;
  isViewInStep: boolean;
}

/** List entry for view-in-step, including master `bothSide` from `UploadCategory`. */
export interface DealerWiseUploadCategoryViewInStepEntryDto
  extends DealerWiseUploadCategoryListEntryDto {
  bothSide: boolean;
}

/**
 * `data` shape for listing (and reorder) — single `dealerId` and an array of per-link category rows.
 */
export interface DealerWiseUploadCategoriesByDealerDto {
  dealerId: string;
  uploadCategory: DealerWiseUploadCategoryListEntryDto[];
}

/** `data` shape for GET view-in-step. */
export interface DealerWiseUploadCategoriesViewInStepDto {
  dealerId: string;
  uploadCategory: DealerWiseUploadCategoryViewInStepEntryDto[];
}

/**
 * Maps a Prisma row (with included `uploadCategory`) to the public response DTO.
 */
const toDealerWiseUploadCategoryDto = (
  row: DealerWiseUploadCategoryWithCategory,
): DealerWiseUploadCategoryResponseDto => ({
  dwucId: row.dwucId,
  dealerId: row.dealerId,
  uploadCategory: {
    categoryId: row.uploadCategory.categoryId,
    categoryName: row.uploadCategory.categoryName,
    orderRank: row.orderRank,
    isRequired: row.isRequired,
    processApi: row.uploadCategory.processApi ?? row.processApi,
    isProcess: row.isProcess,
    isViewInStep: row.isViewInStep,
  },
});

/**
 * Maps a Prisma row to a flat list entry under `uploadCategory[]`.
 */
const toDealerWiseUploadCategoryListEntry = (
  row: DealerWiseUploadCategoryWithCategory,
): DealerWiseUploadCategoryListEntryDto => ({
  dwucId: row.dwucId,
  categoryId: row.uploadCategory.categoryId,
  categoryName: row.uploadCategory.categoryName,
  orderRank: row.orderRank,
  isRequired: row.isRequired,
  processApi: row.uploadCategory.processApi ?? row.processApi,
  isProcess: row.isProcess,
  isViewInStep: row.isViewInStep,
});

const toDealerWiseUploadCategoriesByDealer = (
  dealerId: string,
  rows: DealerWiseUploadCategoryWithCategory[],
): DealerWiseUploadCategoriesByDealerDto => ({
  dealerId,
  uploadCategory: rows.map(toDealerWiseUploadCategoryListEntry),
});

/**
 * Maps a Prisma row to a view-in-step list entry (includes master `bothSide`).
 */
const toDealerWiseUploadCategoryViewInStepEntry = (
  row: DealerWiseUploadCategoryWithCategory,
): DealerWiseUploadCategoryViewInStepEntryDto => ({
  ...toDealerWiseUploadCategoryListEntry(row),
  bothSide: row.uploadCategory.bothSide,
});

const toDealerWiseUploadCategoriesViewInStep = (
  dealerId: string,
  rows: DealerWiseUploadCategoryWithCategory[],
): DealerWiseUploadCategoriesViewInStepDto => ({
  dealerId,
  uploadCategory: rows.map(toDealerWiseUploadCategoryViewInStepEntry),
});

const normalizeProcessApi = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const t = value.trim();
  return t.length === 0 ? null : t;
};

/**
 * Ensures the dealer exists.
 */
const assertDealerExists = async (dealerId: string): Promise<void> => {
  const dealer = await dealerRepository.findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }
};

/**
 * Loads a dealer-wise row or throws 404.
 */
export async function getDealerWiseUploadCategoryById(
  dwucId: string,
): Promise<DealerWiseUploadCategoryResponseDto> {
  const row = await dealerWiseUploadCategoryRepository.findDealerWiseUploadCategoryById(dwucId);
  if (!row) {
    throw new AppError('Dealer upload category link not found', StatusCodes.NOT_FOUND, 4052);
  }
  return toDealerWiseUploadCategoryDto(row);
}

/**
 * Creates a link; `uploadCategoryId` must be unique per `dealerId`.
 */
export async function createDealerWiseUploadCategory(
  input: CreateDealerWiseUploadCategoryInput,
): Promise<DealerWiseUploadCategoryResponseDto> {
  await assertDealerExists(input.dealerId);
  await getUploadCategoryById(input.uploadCategoryId);
  const existing = await dealerWiseUploadCategoryRepository.findDealerWiseUploadByDealerAndCategory(
    input.dealerId,
    input.uploadCategoryId,
  );
  if (existing) {
    throw new AppError(
      'This upload category is already assigned to this dealer',
      StatusCodes.CONFLICT,
      4098,
    );
  }
  const created = await dealerWiseUploadCategoryRepository.createDealerWiseUploadCategory({
    dealerId: input.dealerId,
    uploadCategoryId: input.uploadCategoryId,
    processApi: normalizeProcessApi(input.processApi),
    isRequired: input.isRequired,
    isProcess: input.isProcess,
    isViewInStep: input.isViewInStep,
  });
  return toDealerWiseUploadCategoryDto(created);
}

/**
 * Lists all links for a dealer (no pagination), ordered by `orderRank`.
 */
export async function listDealerWiseUploadCategories(
  dealerId: string,
): Promise<DealerWiseUploadCategoriesByDealerDto> {
  await assertDealerExists(dealerId);
  const rows =
    await dealerWiseUploadCategoryRepository.listDealerWiseUploadCategoriesByDealerId(dealerId);
  return toDealerWiseUploadCategoriesByDealer(dealerId, rows);
}

/**
 * Lists links for a dealer with `isViewInStep === true` only, ordered by `orderRank`.
 * Each entry includes master `bothSide` from `UploadCategory`.
 */
export async function listDealerWiseUploadCategoriesViewInStep(
  dealerId: string,
): Promise<DealerWiseUploadCategoriesViewInStepDto> {
  await assertDealerExists(dealerId);
  const rows =
    await dealerWiseUploadCategoryRepository.listDealerWiseUploadCategoriesByDealerIdViewInStep(
      dealerId,
    );
  return toDealerWiseUploadCategoriesViewInStep(dealerId, rows);
}

/**
 * Updates a link; changing `uploadCategoryId` must stay unique per dealer.
 */
export async function updateDealerWiseUploadCategory(
  dwucId: string,
  input: UpdateDealerWiseUploadCategoryInput,
): Promise<DealerWiseUploadCategoryResponseDto> {
  const current = await dealerWiseUploadCategoryRepository.findDealerWiseUploadCategoryById(dwucId);
  if (!current) {
    throw new AppError('Dealer upload category link not found', StatusCodes.NOT_FOUND, 4052);
  }
  await getUploadCategoryById(input.uploadCategoryId);
  const conflict = await dealerWiseUploadCategoryRepository.findDealerWiseUploadByDealerAndCategory(
    current.dealerId,
    input.uploadCategoryId,
    dwucId,
  );
  if (conflict) {
    throw new AppError(
      'This upload category is already assigned to this dealer',
      StatusCodes.CONFLICT,
      4098,
    );
  }
  const updated = await dealerWiseUploadCategoryRepository.updateDealerWiseUploadCategory(dwucId, {
    uploadCategoryId: input.uploadCategoryId,
    processApi: normalizeProcessApi(input.processApi),
    isRequired: input.isRequired,
    isProcess: input.isProcess,
    isViewInStep: input.isViewInStep,
  });
  return toDealerWiseUploadCategoryDto(updated);
}

/**
 * Deletes a link by `dwucId`.
 */
export async function deleteDealerWiseUploadCategory(dwucId: string): Promise<void> {
  const row = await dealerWiseUploadCategoryRepository.findDealerWiseUploadCategoryById(dwucId);
  if (!row) {
    throw new AppError('Dealer upload category link not found', StatusCodes.NOT_FOUND, 4052);
  }
  await dealerWiseUploadCategoryRepository.deleteDealerWiseUploadCategory(dwucId);
}

/**
 * Bulk-updates `orderRank` for a dealer’s links. Every `dwucId` must belong to `dealerId`.
 * Returns the full list for that dealer ordered by `orderRank` (same pattern as dealer statuses).
 */
export async function updateDealerWiseUploadOrderRanks(
  input: UpdateDealerWiseUploadOrderRanksInput,
): Promise<DealerWiseUploadCategoriesByDealerDto> {
  await assertDealerExists(input.dealerId);
  const current =
    await dealerWiseUploadCategoryRepository.listDealerWiseUploadCategoriesByDealerId(
      input.dealerId,
    );
  const currentIds = new Set(current.map((r) => r.dwucId));
  for (const item of input.items) {
    if (!currentIds.has(item.dwucId)) {
      throw new AppError(
        'One or more upload category links do not belong to this dealer',
        StatusCodes.UNPROCESSABLE_ENTITY,
        4225,
      );
    }
  }
  await dealerWiseUploadCategoryRepository.updateDealerWiseUploadOrderRanks(input.items);
  const rows =
    await dealerWiseUploadCategoryRepository.listDealerWiseUploadCategoriesByDealerId(
      input.dealerId,
    );
  return toDealerWiseUploadCategoriesByDealer(input.dealerId, rows);
}
