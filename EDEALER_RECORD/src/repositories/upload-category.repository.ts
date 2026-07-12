import { prisma } from '../config/prisma';
import type { UploadCategory } from '@prisma/client';

/** Fields required to create an upload category (`orderRank` is assigned in the repository). */
export interface CreateUploadCategoryData {
  categoryName: string;
  bothSide: boolean;
}

/** Fields for updating an upload category. */
export interface UpdateUploadCategoryData {
  categoryName: string;
  bothSide: boolean;
}

/**
 * Creates a row with `orderRank` = max existing `orderRank` + 1 (or 1 if none).
 */
export async function createUploadCategory(data: CreateUploadCategoryData): Promise<UploadCategory> {
  return prisma.$transaction(async (tx) => {
    const maxRow = await tx.uploadCategory.findFirst({
      orderBy: { orderRank: 'desc' },
      select: { orderRank: true },
    });
    const nextOrderRank = (maxRow?.orderRank ?? 0) + 1;
    return tx.uploadCategory.create({
      data: {
        categoryName: data.categoryName,
        orderRank: nextOrderRank,
        bothSide: data.bothSide,
      },
    });
  });
}

/**
 * All categories ordered by `orderRank` ascending (no pagination).
 */
export async function findAllUploadCategories(): Promise<UploadCategory[]> {
  return prisma.uploadCategory.findMany({
    orderBy: { orderRank: 'asc' },
  });
}

/** Find by primary key. */
export async function findUploadCategoryById(categoryId: string): Promise<UploadCategory | null> {
  return prisma.uploadCategory.findUnique({
    where: { categoryId },
  });
}

/** Find by unique name (optional exclude id for update checks). */
export async function findUploadCategoryByName(
  categoryName: string,
  excludeCategoryId?: string,
): Promise<UploadCategory | null> {
  return prisma.uploadCategory.findFirst({
    where: {
      categoryName,
      ...(excludeCategoryId && { categoryId: { not: excludeCategoryId } }),
    },
  });
}

/** Updates name (and timestamps via Prisma). */
export async function updateUploadCategory(
  categoryId: string,
  data: UpdateUploadCategoryData,
): Promise<UploadCategory> {
  return prisma.uploadCategory.update({
    where: { categoryId },
    data,
  });
}

/** Deletes by id. */
export async function deleteUploadCategory(categoryId: string): Promise<UploadCategory> {
  return prisma.uploadCategory.delete({
    where: { categoryId },
  });
}

/** Single item for bulk `orderRank` update. */
export interface UpdateUploadCategoryOrderRankItem {
  categoryId: string;
  orderRank: number;
}

/**
 * Updates `orderRank` for multiple categories in one transaction; returns rows in request order.
 */
export async function updateUploadCategoryOrderRanks(
  items: UpdateUploadCategoryOrderRankItem[],
): Promise<UploadCategory[]> {
  return prisma.$transaction(async (tx) => {
    const results: UploadCategory[] = [];
    for (const { categoryId, orderRank } of items) {
      const updated = await tx.uploadCategory.update({
        where: { categoryId },
        data: { orderRank },
      });
      results.push(updated);
    }
    return results;
  });
}
