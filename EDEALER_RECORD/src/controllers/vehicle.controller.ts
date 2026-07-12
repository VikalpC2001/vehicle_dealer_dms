import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createVehicle,
  listVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getVehicleHistory,
} from '../services/vehicle.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreateVehicleBody,
  UpdateVehicleBody,
  VehicleIdParams,
  VehicleHistoryQuery,
} from '../validations/vehicle.validation';
import type { PaginationQuery } from '../types';

/**
 * POST /vehicles
 * Creates a new vehicle.
 */
export async function createVehicleHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateVehicleBody;
  const vehicle = await createVehicle(body);
  sendSuccess(res, 'Vehicle created', vehicle, StatusCodes.CREATED);
}

/**
 * GET /vehicles
 * Returns a paginated list of vehicles.
 */
export async function listVehiclesHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PaginationQuery;
  const result = await listVehicles(query);
  sendSuccess(res, 'Vehicles retrieved', result);
}

/**
 * GET /vehicles/history?registrationNumber=
 * Per-vehicle buy/sell history for the caller's own dealership + an anonymized market signal.
 * Dealer-scoped (super-admin/agent without a dealer get 4033).
 */
export async function getVehicleHistoryHandler(req: Request, res: Response): Promise<void> {
  const { registrationNumber } = req.query as unknown as VehicleHistoryQuery;
  const dealerId = resolveDealerIdFromRequest(req);
  const data = await getVehicleHistory(dealerId, registrationNumber);
  sendSuccess(res, 'Vehicle history retrieved', data);
}

/**
 * GET /vehicles/:id
 * Returns a single vehicle by ID.
 */
export async function getVehicleByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleIdParams;
  const vehicle = await getVehicleById(id);
  sendSuccess(res, 'Vehicle retrieved', vehicle);
}

/**
 * PATCH /vehicles/:id
 * Updates an existing vehicle.
 */
export async function updateVehicleHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleIdParams;
  const body = req.body as UpdateVehicleBody;
  const vehicle = await updateVehicle(id, body);
  sendSuccess(res, 'Vehicle updated', vehicle);
}

/**
 * DELETE /vehicles/:id
 * Deletes a vehicle.
 */
export async function deleteVehicleHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleIdParams;
  await deleteVehicle(id);
  sendSuccess(res, 'Vehicle deleted', {});
}

