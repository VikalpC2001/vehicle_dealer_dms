import { prisma } from '../config/prisma';
import type { AgentWiseUploadCategory, Prisma } from '@prisma/client';

const categoryInclude = { uploadCategory: true } satisfies Prisma.AgentWiseUploadCategoryInclude;

export type AgentWiseUploadCategoryWithCategory = Prisma.AgentWiseUploadCategoryGetPayload<{
  include: typeof categoryInclude;
}>;

/** Data to create an agent-wise upload category row (`orderRank` assigned in repository). */
export interface CreateAgentWiseUploadCategoryData {
  agentId: string;
  uploadCategoryId: string;
  processApi: string | null;
  isRequired: boolean;
  isProcess: boolean;
  isViewInStep: boolean;
}

/** Full replace on update (excluding `orderRank`; use PUT /order for rank). */
export interface UpdateAgentWiseUploadCategoryData {
  uploadCategoryId: string;
  processApi: string | null;
  isRequired: boolean;
  isProcess: boolean;
  isViewInStep: boolean;
}

export interface UpdateAgentWiseOrderRankItem {
  awucId: string;
  orderRank: number;
}

/**
 * Creates a row with `orderRank` = max for that `agentId` + 1.
 */
export async function createAgentWiseUploadCategory(
  data: CreateAgentWiseUploadCategoryData,
): Promise<AgentWiseUploadCategoryWithCategory> {
  return prisma.$transaction(async (tx) => {
    const maxRow = await tx.agentWiseUploadCategory.findFirst({
      where: { agentId: data.agentId },
      orderBy: { orderRank: 'desc' },
      select: { orderRank: true },
    });
    const nextOrderRank = (maxRow?.orderRank ?? 0) + 1;
    return tx.agentWiseUploadCategory.create({
      data: {
        agentId: data.agentId,
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
 * All rows for an agent, ordered by `orderRank`, including global category.
 */
export async function listAgentWiseUploadCategoriesByAgentId(
  agentId: string,
): Promise<AgentWiseUploadCategoryWithCategory[]> {
  return prisma.agentWiseUploadCategory.findMany({
    where: { agentId },
    orderBy: { orderRank: 'asc' },
    include: categoryInclude,
  });
}

/**
 * Rows for an agent where `isViewInStep` is true, ordered by `orderRank`.
 */
export async function listAgentWiseUploadCategoriesByAgentIdViewInStep(
  agentId: string,
): Promise<AgentWiseUploadCategoryWithCategory[]> {
  return prisma.agentWiseUploadCategory.findMany({
    where: { agentId, isViewInStep: true },
    orderBy: { orderRank: 'asc' },
    include: categoryInclude,
  });
}

/** By primary key with category include. */
export async function findAgentWiseUploadCategoryById(
  awucId: string,
): Promise<AgentWiseUploadCategoryWithCategory | null> {
  return prisma.agentWiseUploadCategory.findUnique({
    where: { awucId },
    include: categoryInclude,
  });
}

/** Duplicate check for create / update category change. */
export async function findAgentWiseUploadByAgentAndCategory(
  agentId: string,
  uploadCategoryId: string,
  excludeAwucId?: string,
): Promise<AgentWiseUploadCategory | null> {
  return prisma.agentWiseUploadCategory.findFirst({
    where: {
      agentId,
      uploadCategoryId,
      ...(excludeAwucId && { awucId: { not: excludeAwucId } }),
    },
  });
}

/** Updates mutable fields (not `agentId` or `orderRank`). */
export async function updateAgentWiseUploadCategory(
  awucId: string,
  data: UpdateAgentWiseUploadCategoryData,
): Promise<AgentWiseUploadCategoryWithCategory> {
  return prisma.agentWiseUploadCategory.update({
    where: { awucId },
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
export async function deleteAgentWiseUploadCategory(
  awucId: string,
): Promise<AgentWiseUploadCategory> {
  return prisma.agentWiseUploadCategory.delete({
    where: { awucId },
  });
}

/**
 * Bulk-updates `orderRank` for an agent's rows; returns updated rows with category in request order.
 */
export async function updateAgentWiseUploadOrderRanks(
  items: UpdateAgentWiseOrderRankItem[],
): Promise<AgentWiseUploadCategoryWithCategory[]> {
  return prisma.$transaction(async (tx) => {
    const results: AgentWiseUploadCategoryWithCategory[] = [];
    for (const { awucId, orderRank } of items) {
      const updated = await tx.agentWiseUploadCategory.update({
        where: { awucId },
        data: { orderRank },
        include: categoryInclude,
      });
      results.push(updated);
    }
    return results;
  });
}
