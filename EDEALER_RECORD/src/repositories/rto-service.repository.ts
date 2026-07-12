import { prisma } from '../config/prisma';
import type { RtoService } from '@prisma/client';

/**
 * Data required to create a new RTO service. Both fields are required and must be unique.
 */
export interface CreateRtoServiceData {
  serviceName: string;
  shortName: string;
}

/**
 * Data required when updating an existing RTO service. Both fields are required and must be unique.
 */
export interface UpdateRtoServiceData {
  serviceName: string;
  shortName: string;
}

/**
 * Creates a new RTO service with `orderRank` set to max existing `orderRank` + 1 (or 1 if none).
 */
export async function createRtoService(data: CreateRtoServiceData): Promise<RtoService> {
  return prisma.$transaction(async (tx) => {
    const maxRankRow = await tx.rtoService.findFirst({
      orderBy: { orderRank: 'desc' },
      select: { orderRank: true },
    });

    const nextOrderRank = (maxRankRow?.orderRank ?? 0) + 1;

    return tx.rtoService.create({
      data: {
        serviceName: data.serviceName,
        shortName: data.shortName,
        orderRank: nextOrderRank,
      },
    });
  });
}

/**
 * Returns a paginated list of RTO services along with the total count.
 */
export async function listRtoServices(
  skip: number,
  take: number,
): Promise<{ items: RtoService[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.rtoService.findMany({
      skip,
      take,
      orderBy: { orderRank: 'asc' },
    }),
    prisma.rtoService.count(),
  ]);

  return { items, total };
}

/**
 * Finds a single RTO service by ID.
 */
export async function findRtoServiceById(serviceId: string): Promise<RtoService | null> {
  return prisma.rtoService.findUnique({
    where: { serviceId },
  });
}

/**
 * Finds an RTO service by serviceName. Optionally exclude a service ID (for update uniqueness check).
 */
export async function findRtoServiceByServiceName(
  serviceName: string,
  excludeServiceId?: string,
): Promise<RtoService | null> {
  return prisma.rtoService.findFirst({
    where: {
      serviceName,
      ...(excludeServiceId && { serviceId: { not: excludeServiceId } }),
    },
  });
}

/**
 * Finds an RTO service by shortName. Optionally exclude a service ID (for update uniqueness check).
 */
export async function findRtoServiceByShortName(
  shortName: string,
  excludeServiceId?: string,
): Promise<RtoService | null> {
  return prisma.rtoService.findFirst({
    where: {
      shortName,
      ...(excludeServiceId && { serviceId: { not: excludeServiceId } }),
    },
  });
}

/**
 * Updates an existing RTO service.
 */
export async function updateRtoService(
  serviceId: string,
  data: UpdateRtoServiceData,
): Promise<RtoService> {
  return prisma.rtoService.update({
    where: { serviceId },
    data,
  });
}

/**
 * Deletes an RTO service by ID.
 */
export async function deleteRtoService(serviceId: string): Promise<RtoService> {
  return prisma.rtoService.delete({
    where: { serviceId },
  });
}

/**
 * Item for bulk orderRank update. Only orderRank is updated; serviceName/shortName are ignored.
 */
export interface UpdateOrderRankItem {
  serviceId: string;
  orderRank: number;
}

/**
 * Updates orderRank for multiple RTO services in one transaction. Returns updated services in request order.
 */
export async function updateOrderRanks(
  items: UpdateOrderRankItem[],
): Promise<RtoService[]> {
  return prisma.$transaction(async (tx) => {
    const results: RtoService[] = [];
    for (const { serviceId, orderRank } of items) {
      const updated = await tx.rtoService.update({
        where: { serviceId },
        data: { orderRank },
      });
      results.push(updated);
    }
    return results;
  });
}

