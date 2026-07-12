import { prisma } from '../config/prisma';
import type { DealerWiseUploadCategory, Prisma } from '@prisma/client';

const categoryInclude = { uploadCategory: true } satisfies Prisma.DealerWiseUploadCategoryInclude;

export type DealerWiseUploadCategoryWithCategory = Prisma.DealerWiseUploadCategoryGetPayload<{
  include: typeof categoryInclude;
}>;

/** Data to create a dealer-wise upload category row (`orderRank` assigned in repository). */
export interface CreateDealerWiseUploadCategoryData {
  dealerId: string;
  uploadCategoryId: string;
  processApi: string | null;
  isRequired: boolean;
  isProcess: boolean;
  isViewInStep: boolean;
}

/** Full replace on update (excluding `orderRank`; use PUT /order for rank). */
export interface UpdateDealerWiseUploadCategoryData {
  uploadCategoryId: string;
  processApi: string | null;
  isRequired: boolean;
  isProcess: boolean;
  isViewInStep: boolean;
}

export interface UpdateDealerWiseOrderRankItem {
  dwucId: string;
  orderRank: number;
}

/**
 * Creates a row with `orderRank` = max for that `dealerId` + 1.
 */
export async function createDealerWiseUploadCategory(
  data: CreateDealerWiseUploadCategoryData,
): Promise<DealerWiseUploadCategoryWithCategory> {
  return prisma.$transaction(async (tx) => {
    const maxRow = await tx.dealerWiseUploadCategory.findFirst({
      where: { dealerId: data.dealerId },
      orderBy: { orderRank: 'desc' },
      select: { orderRank: true },
    });
    const nextOrderRank = (maxRow?.orderRank ?? 0) + 1;
    return tx.dealerWiseUploadCategory.create({
      data: {
        dealerId: data.dealerId,
        uploadCategoryId: data.uploadCategoryId,
        processApi: data.processApi,
        orderRank: nextOrderRank,
        isRequired: data.isRequired,
        isProcess: data.isProcess,
        isViewInStep: data.isViewInStep,
      },
      include: categoryInclude,
    });
  });
}

/**
 * All rows for a dealer, ordered by `orderRank`, including global category.
 */
export async function listDealerWiseUploadCategoriesByDealerId(
  dealerId: string,
): Promise<DealerWiseUploadCategoryWithCategory[]> {
  return prisma.dealerWiseUploadCategory.findMany({
    where: { dealerId },
    orderBy: { orderRank: 'asc' },
    include: categoryInclude,
  });
}

/**
 * Rows for a dealer where `isViewInStep` is true, ordered by `orderRank`.
 */
export async function listDealerWiseUploadCategoriesByDealerIdViewInStep(
  dealerId: string,
): Promise<DealerWiseUploadCategoryWithCategory[]> {
  return prisma.dealerWiseUploadCategory.findMany({
    where: { dealerId, isViewInStep: true },
    orderBy: { orderRank: 'asc' },
    include: categoryInclude,
  });
}

/** By primary key with category include. */
export async function findDealerWiseUploadCategoryById(
  dwucId: string,
): Promise<DealerWiseUploadCategoryWithCategory | null> {
  return prisma.dealerWiseUploadCategory.findUnique({
    where: { dwucId },
    include: categoryInclude,
  });
}

/** Duplicate check for create / update category change. */
export async function findDealerWiseUploadByDealerAndCategory(
  dealerId: string,
  uploadCategoryId: string,
  excludeDwucId?: string,
): Promise<DealerWiseUploadCategory | null> {
  return prisma.dealerWiseUploadCategory.findFirst({
    where: {
      dealerId,
      uploadCategoryId,
      ...(excludeDwucId && { dwucId: { not: excludeDwucId } }),
    },
  });
}

/** Updates mutable fields (not `dealerId` or `orderRank`). */
export async function updateDealerWiseUploadCategory(
  dwucId: string,
  data: UpdateDealerWiseUploadCategoryData,
): Promise<DealerWiseUploadCategoryWithCategory> {
  return prisma.dealerWiseUploadCategory.update({
    where: { dwucId },
    data: {
      uploadCategoryId: data.uploadCategoryId,
      processApi: data.processApi,
      isRequired: data.isRequired,
      isProcess: data.isProcess,
      isViewInStep: data.isViewInStep,
    },
    include: categoryInclude,
  });
}

/** Deletes by id. */
export async function deleteDealerWiseUploadCategory(
  dwucId: string,
): Promise<DealerWiseUploadCategory> {
  return prisma.dealerWiseUploadCategory.delete({
    where: { dwucId },
  });
}

/**
 * Bulk-updates `orderRank` for a dealer’s rows; returns updated rows with category in request order.
 */
export async function updateDealerWiseUploadOrderRanks(
  items: UpdateDealerWiseOrderRankItem[],
): Promise<DealerWiseUploadCategoryWithCategory[]> {
  return prisma.$transaction(async (tx) => {
    const results: DealerWiseUploadCategoryWithCategory[] = [];
    for (const { dwucId, orderRank } of items) {
      const updated = await tx.dealerWiseUploadCategory.update({
        where: { dwucId },
        data: { orderRank },
        include: categoryInclude,
      });
      results.push(updated);
    }
    return results;
  });
}
