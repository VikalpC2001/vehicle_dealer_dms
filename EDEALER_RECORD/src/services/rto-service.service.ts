import { StatusCodes } from 'http-status-codes';
import type { RtoService } from '@prisma/client';
import * as rtoServiceRepository from '../repositories/rto-service.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';

/**
 * Input for creating a new RTO service. Both serviceName and shortName are required and must be unique.
 */
export interface CreateRtoServiceInput {
  serviceName: string;
  shortName: string;
}

/**
 * Input for updating an existing RTO service. Both fields are required and must be unique.
 */
export interface UpdateRtoServiceInput {
  serviceName: string;
  shortName: string;
}

/**
 * Creates a new RTO service. Throws if serviceName or shortName already exists.
 */
export async function createRtoService(input: CreateRtoServiceInput): Promise<RtoService> {
  const existingByName = await rtoServiceRepository.findRtoServiceByServiceName(input.serviceName);
  if (existingByName) {
    throw new AppError('Service name already exists', StatusCodes.CONFLICT, 4092);
  }
  const existingByShort = await rtoServiceRepository.findRtoServiceByShortName(input.shortName);
  if (existingByShort) {
    throw new AppError('Short name already exists', StatusCodes.CONFLICT, 4093);
  }
  return rtoServiceRepository.createRtoService({
    serviceName: input.serviceName,
    shortName: input.shortName,
  });
}

/**
 * Returns a paginated list of RTO services.
 */
export async function listRtoServices(
  query: PaginationQuery,
): Promise<PaginatedResult<RtoService>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await rtoServiceRepository.listRtoServices(skip, take);
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

/**
 * Retrieves a single RTO service by ID, or throws if not found.
 */
export async function getRtoServiceById(serviceId: string): Promise<RtoService> {
  const service = await rtoServiceRepository.findRtoServiceById(serviceId);
  if (!service) {
    throw new AppError('RTO service not found', StatusCodes.NOT_FOUND, 4042);
  }
  return service;
}

/**
 * Updates an existing RTO service. Throws if another record has the same serviceName or shortName.
 */
export async function updateRtoService(
  serviceId: string,
  input: UpdateRtoServiceInput,
): Promise<RtoService> {
  await getRtoServiceById(serviceId);
  const existingByName = await rtoServiceRepository.findRtoServiceByServiceName(
    input.serviceName,
    serviceId,
  );
  if (existingByName) {
    throw new AppError('Service name already exists', StatusCodes.CONFLICT, 4092);
  }
  const existingByShort = await rtoServiceRepository.findRtoServiceByShortName(
    input.shortName,
    serviceId,
  );
  if (existingByShort) {
    throw new AppError('Short name already exists', StatusCodes.CONFLICT, 4093);
  }
  return rtoServiceRepository.updateRtoService(serviceId, {
    serviceName: input.serviceName,
    shortName: input.shortName,
  });
}

/**
 * Deletes an RTO service by ID.
 */
export async function deleteRtoService(serviceId: string): Promise<void> {
  // Ensure it exists; if not, surface 404.
  await getRtoServiceById(serviceId);
  await rtoServiceRepository.deleteRtoService(serviceId);
}

/**
 * Input item for bulk orderRank update. serviceName/shortName are optional (ignored on update).
 */
export interface UpdateOrderRanksItem {
  serviceId: string;
  serviceName?: string;
  shortName?: string;
  orderRank: number;
}

/**
 * Updates orderRank for multiple RTO services. All serviceIds must exist; returns updated services in request order.
 */
export async function updateOrderRanks(
  items: UpdateOrderRanksItem[],
): Promise<RtoService[]> {
  for (const item of items) {
    await getRtoServiceById(item.serviceId);
  }
  return rtoServiceRepository.updateOrderRanks(
    items.map(({ serviceId, orderRank }) => ({ serviceId, orderRank })),
  );
}

