import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createVehicleProcess,
  startVehicleProcessWithVehicle,
  listVehicleProcesses,
  getVehicleProcessById,
  getVehicleProcessDetails,
  updateVehicleProcess,
  deleteVehicleProcess,
} from '../services/vehicle-process.service';
import { sendSuccess } from '../utils/api-response';
import { buildPaginationMeta } from '../utils/pagination';
import { assertDealerMatchesToken, resolveDealerIdFromRequest } from '../utils/dealer-scope';
import { resolveUploadPublicOrigin } from '../utils/request-origin';
import type { PaginationQuery } from '../types';
import type {
  CreateVehicleProcessBody,
  StartVehicleProcessWithVehicleBody,
  UpdateVehicleProcessBody,
  VehicleProcessIdParams,
} from '../validations/vehicle-process.validation';

/**
 * POST /vehicle-processes/start — upsert vehicle, create Pending process for JWT dealer.
 */
export async function startVehicleProcessWithVehicleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as StartVehicleProcessWithVehicleBody;
  const { dealerId: bodyDealerId, ...rest } = body;
  const dealerId = resolveDealerIdFromRequest(req, bodyDealerId);
  const data = await startVehicleProcessWithVehicle(dealerId, rest);
  sendSuccess(res, 'Vehicle process started', data, StatusCodes.CREATED);
}

export async function createVehicleProcessHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateVehicleProcessBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const process = await createVehicleProcess({ ...body, dealerId });
  sendSuccess(res, 'Vehicle process created', process, StatusCodes.CREATED);
}

export async function listVehicleProcessesHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PaginationQuery;
  let scope: string | null;
  if (req.user.isSuperAdmin) {
    // Super-admin sees all, or a specific dealer via ?dealerId=.
    const q = req.query as { dealerId?: string };
    scope = q.dealerId?.trim() || null;
  } else if (req.user.dealerId) {
    scope = req.user.dealerId;
  } else {
    // Neither super-admin nor a dealer (e.g. an agent or unlinked user): no dealer processes.
    sendSuccess(res, 'Vehicle processes retrieved', { data: [], meta: buildPaginationMeta(0, query) });
    return;
  }
  const result = await listVehicleProcesses(query, scope);
  sendSuccess(res, 'Vehicle processes retrieved', result);
}

export async function getVehicleProcessByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const process = await getVehicleProcessById(id);
  assertDealerMatchesToken(req, process.dealerId);
  sendSuccess(res, 'Vehicle process retrieved', process);
}

/**
 * GET /vehicle-processes/:id/details
 * Returns vehicle, owner, buyer, references, and photo URLs in one response.
 */
export async function getVehicleProcessDetailsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const publicOrigin = resolveUploadPublicOrigin(req);
  const data = await getVehicleProcessDetails(id, publicOrigin);
  assertDealerMatchesToken(req, data.dealerId);
  sendSuccess(res, 'Vehicle process details retrieved', data);
}

export async function updateVehicleProcessHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const body = req.body as UpdateVehicleProcessBody;
  const existing = await getVehicleProcessById(id);
  assertDealerMatchesToken(req, existing.dealerId);
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const process = await updateVehicleProcess(id, { ...body, dealerId });
  sendSuccess(res, 'Vehicle process updated', process);
}

export async function deleteVehicleProcessHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const existing = await getVehicleProcessById(id);
  assertDealerMatchesToken(req, existing.dealerId);
  await deleteVehicleProcess(id);
  sendSuccess(res, 'Vehicle process deleted', {});
}

