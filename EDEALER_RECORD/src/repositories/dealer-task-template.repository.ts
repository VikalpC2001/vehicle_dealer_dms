import { prisma } from '../config/prisma';
import type { DealerTaskTemplate } from '@prisma/client';

/**
 * Data required to create a new dealer task template.
 * templateName is required and must be unique per dealer.
 */
export interface CreateDealerTaskTemplateData {
  dealerId: string;
  templateName: string;
}

/**
 * Data allowed when updating a dealer task template.
 * templateName is required and must be unique per dealer (excluding current template).
 */
export interface UpdateDealerTaskTemplateData {
  templateName: string;
}

/**
 * Creates a new dealer task template.
 */
export async function createDealerTaskTemplate(
  data: CreateDealerTaskTemplateData,
): Promise<DealerTaskTemplate> {
  return prisma.dealerTaskTemplate.create({
    data,
  });
}

/**
 * Returns a paginated list of dealer task templates and total count.
 * Filters by dealerId and orders by templateName ascending.
 */
export async function listDealerTaskTemplates(
  skip: number,
  take: number,
  dealerId: string,
): Promise<{ items: DealerTaskTemplate[]; total: number }> {
  const where = { dealerId };
  const [items, total] = await Promise.all([
    prisma.dealerTaskTemplate.findMany({
      where,
      skip,
      take,
      orderBy: { templateName: 'asc' },
    }),
    prisma.dealerTaskTemplate.count({ where }),
  ]);
  return { items, total };
}

/**
 * Finds a single dealer task template by ID.
 */
export async function findDealerTaskTemplateById(
  templateId: string,
): Promise<DealerTaskTemplate | null> {
  return prisma.dealerTaskTemplate.findUnique({
    where: { templateId },
  });
}

/**
 * Finds a dealer task template by dealerId and templateName.
 * Optionally exclude a templateId (for update uniqueness check).
 */
export async function findDealerTaskTemplateByDealerAndName(
  dealerId: string,
  templateName: string,
  excludeTemplateId?: string,
): Promise<DealerTaskTemplate | null> {
  return prisma.dealerTaskTemplate.findFirst({
    where: {
      dealerId,
      templateName,
      ...(excludeTemplateId && { templateId: { not: excludeTemplateId } }),
    },
  });
}

/**
 * Updates an existing dealer task template.
 */
export async function updateDealerTaskTemplate(
  templateId: string,
  data: UpdateDealerTaskTemplateData,
): Promise<DealerTaskTemplate> {
  return prisma.dealerTaskTemplate.update({
    where: { templateId },
    data,
  });
}

/**
 * Deletes a dealer task template by ID.
 */
export async function deleteDealerTaskTemplate(
  templateId: string,
): Promise<DealerTaskTemplate> {
  return prisma.dealerTaskTemplate.delete({
    where: { templateId },
  });
}
