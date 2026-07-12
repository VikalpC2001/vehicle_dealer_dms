import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createRtoService,
  listRtoServices,
  getRtoServiceById,
  updateRtoService,
  deleteRtoService,
  updateOrderRanks,
} from '../services/rto-service.service';
import { sendSuccess } from '../utils/api-response';
import type {
  CreateRtoServiceBody,
  UpdateRtoServiceBody,
  RtoServiceIdParams,
  UpdateOrderRanksBody,
} from '../validations/rto-service.validation';
import type { PaginationQuery } from '../types';

/**
 * POST /rto-services
 * Creates a new RTO service.
 */
export async function createRtoServiceHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateRtoServiceBody;
  const service = await createRtoService(body);
  sendSuccess(res, 'RTO service created', service, StatusCodes.CREATED);
}

/**
 * GET /rto-services
 * Returns a paginated list of RTO services.
 */
export async function listRtoServicesHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PaginationQuery;
  const result = await listRtoServices(query);
  sendSuccess(res, 'RTO services retrieved', result);
}

/**
 * GET /rto-services/:id
 * Returns a single RTO service by ID.
 */
export async function getRtoServiceByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RtoServiceIdParams;
  const service = await getRtoServiceById(id);
  sendSuccess(res, 'RTO service retrieved', service);
}

/**
 * PATCH /rto-services/:id
 * Updates an existing RTO service.
 */
export async function updateRtoServiceHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RtoServiceIdParams;
  const body = req.body as UpdateRtoServiceBody;
  const service = await updateRtoService(id, body);
  sendSuccess(res, 'RTO service updated', service);
}

/**
 * DELETE /rto-services/:id
 * Deletes an RTO service.
 */
export async function deleteRtoServiceHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RtoServiceIdParams;
  await deleteRtoService(id);
  sendSuccess(res, 'RTO service deleted', {});
}

/**
 * PUT /rto-services/order
 * Updates orderRank for multiple RTO services. Body is an array of { serviceId, orderRank } (serviceName/shortName optional).
 */
export async function updateOrderRanksHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as UpdateOrderRanksBody;
  const services = await updateOrderRanks(body);
  sendSuccess(res, 'Order ranks updated', services);
}

