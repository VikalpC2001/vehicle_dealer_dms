import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createVehicleProcess,
  startVehicleProcessWithVehicle,
  listVehicleProcesses,
  listAgentBoardProcesses,
  getVehicleProcessById,
  getVehicleProcessDetails,
  updateVehicleProcess,
  updateVehicleProcessAgentStatus,
  setProcessReceipt,
  clearProcessReceipt,
  setProcessTrackingNumber,
  setVehicleProcessStatus,
  setVehicleProcessTags,
  deleteVehicleProcess,
} from '../services/vehicle-process.service';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import { buildPaginationMeta } from '../utils/pagination';
import {
  resolveManagedDealerId,
  assertManagedDealerMatches,
  assertAgentCanWriteProcess,
} from '../utils/managed-dealer-scope';
import { resolveUploadPublicOrigin } from '../utils/request-origin';
import type { PaginationQuery } from '../types';
import type {
  CreateVehicleProcessBody,
  StartVehicleProcessWithVehicleBody,
  UpdateVehicleProcessBody,
  UpdateVehicleProcessAgentStatusBody,
  SetVehicleProcessReceiptBody,
  SetVehicleProcessTrackingBody,
  SetVehicleProcessStatusBody,
  SetVehicleProcessTagsBody,
  VehicleProcessIdParams,
} from '../validations/vehicle-process.validation';
import type { VehicleProcessStatusFilter } from '../repositories/vehicle-process.repository';

/**
 * POST /vehicle-processes/start — upsert vehicle, create Pending process for JWT dealer.
 */
export async function startVehicleProcessWithVehicleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as StartVehicleProcessWithVehicleBody;
  const { dealerId: bodyDealerId, ...rest } = body;
  const dealerId = await resolveManagedDealerId(req, bodyDealerId);
  const data = await startVehicleProcessWithVehicle(dealerId, rest);
  sendSuccess(res, 'Vehicle process started', data, StatusCodes.CREATED);
}

export async function createVehicleProcessHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateVehicleProcessBody;
  const dealerId = await resolveManagedDealerId(req, body.dealerId);
  const process = await createVehicleProcess({ ...body, dealerId });
  sendSuccess(res, 'Vehicle process created', process, StatusCodes.CREATED);
}

export async function listVehicleProcessesHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PaginationQuery;
  const q = req.query as {
    dealerId?: string;
    search?: string;
    tagId?: string;
    status?: VehicleProcessStatusFilter;
  };
  const search = q.search?.trim() || null;
  const tagId = q.tagId?.trim() || null;
  const status = q.status ?? null;
  let scope: string | null;
  if (req.user.isSuperAdmin) {
    // Super-admin sees all, or a specific dealer via ?dealerId=.
    scope = q.dealerId?.trim() || null;
  } else if (req.user.dealerId) {
    scope = req.user.dealerId;
  } else if (req.user.agentId) {
    // Agent: list a specific dealer they manage (placeholder they own or a granted real dealer).
    // Reads are not subscription-gated.
    scope = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  } else {
    // Unlinked user: no dealer processes.
    sendSuccess(res, 'Vehicle processes retrieved', { data: [], meta: buildPaginationMeta(0, query) });
    return;
  }
  const result = await listVehicleProcesses(query, scope, search, tagId, status);
  sendSuccess(res, 'Vehicle processes retrieved', result);
}

/**
 * GET /vehicle-processes/agent-board — the caller agent's own (agent-created, placeholder-dealer)
 * processes for the agent board. Non-agent callers get an empty list (they have no agent board).
 */
export async function listAgentBoardProcessesHandler(req: Request, res: Response): Promise<void> {
  const agentId = req.user.agentId ?? null;
  const data = agentId ? await listAgentBoardProcesses(agentId) : [];
  sendSuccess(res, 'Agent board processes retrieved', data);
}

/**
 * PATCH /vehicle-processes/:id/agent-status — move an agent-created process into one of the owning
 * agent's kanban columns (agent board). Authorized via managed-dealer scope.
 */
export async function updateVehicleProcessAgentStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const { agentStatusId } = req.body as UpdateVehicleProcessAgentStatusBody;
  const existing = await getVehicleProcessById(id);
  await assertManagedDealerMatches(req, existing.dealerId);
  if (!existing.dealerId) {
    throw new AppError('This process is not linked to a dealer', StatusCodes.UNPROCESSABLE_ENTITY, 4226);
  }
  const process = await updateVehicleProcessAgentStatus(id, existing.dealerId, agentStatusId);
  sendSuccess(res, 'Vehicle process status updated', process);
}

/**
 * PATCH /vehicle-processes/:id/receipt — the agent working the process uploads/replaces the RTO
 * receipt (PDF or image). Agent-only (+ super-admin); the dealer can only download it.
 */
export async function setVehicleProcessReceiptHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const { imageName } = req.body as SetVehicleProcessReceiptBody;
  const existing = await getVehicleProcessById(id);
  await assertAgentCanWriteProcess(req, existing);
  const process = await setProcessReceipt(id, imageName);
  sendSuccess(res, 'Receipt uploaded', process);
}

/**
 * DELETE /vehicle-processes/:id/receipt — the agent removes the RTO receipt. Agent-only (+ super-admin).
 */
export async function deleteVehicleProcessReceiptHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const existing = await getVehicleProcessById(id);
  await assertAgentCanWriteProcess(req, existing);
  const process = await clearProcessReceipt(id);
  sendSuccess(res, 'Receipt removed', process);
}

/**
 * PATCH /vehicle-processes/:id/tracking — the agent sets/clears the RC-book tracking number after
 * dispatch (optional). Agent-only (+ super-admin); the dealer reads it to track the RC book.
 */
export async function setVehicleProcessTrackingHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const { trackingNumber } = req.body as SetVehicleProcessTrackingBody;
  const existing = await getVehicleProcessById(id);
  await assertAgentCanWriteProcess(req, existing);
  const process = await setProcessTrackingNumber(id, trackingNumber);
  sendSuccess(res, 'Tracking number updated', process);
}

/**
 * PATCH /vehicle-processes/:id/status — set or clear a process's fixed lifecycle status
 * (SOLD/COMPLETE/SCRAP or null = OPEN). The caller must manage the process's dealer. Clearing back to
 * OPEN is rejected (409/4113) when another open process already exists for the vehicle.
 */
export async function setVehicleProcessStatusHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const { status } = req.body as SetVehicleProcessStatusBody;
  const existing = await getVehicleProcessById(id);
  await assertManagedDealerMatches(req, existing.dealerId);
  const process = await setVehicleProcessStatus(id, status);
  sendSuccess(res, 'Vehicle process status updated', process);
}

/**
 * PUT /vehicle-processes/:id/tags — full-replace the process's tags (empty array clears them). The
 * caller must manage the process's dealer; every tag must belong to that same dealer.
 */
export async function setVehicleProcessTagsHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const { tagIds } = req.body as SetVehicleProcessTagsBody;
  const existing = await getVehicleProcessById(id);
  await assertManagedDealerMatches(req, existing.dealerId);
  if (!existing.dealerId) {
    throw new AppError('This process is not linked to a dealer', StatusCodes.UNPROCESSABLE_ENTITY, 4226);
  }
  const tags = await setVehicleProcessTags(id, existing.dealerId, tagIds);
  sendSuccess(res, 'Vehicle process tags updated', tags);
}

export async function getVehicleProcessByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const process = await getVehicleProcessById(id);
  await assertManagedDealerMatches(req, process.dealerId);
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
  await assertManagedDealerMatches(req, data.dealerId);
  sendSuccess(res, 'Vehicle process details retrieved', data);
}

export async function updateVehicleProcessHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const body = req.body as UpdateVehicleProcessBody;
  const existing = await getVehicleProcessById(id);
  await assertManagedDealerMatches(req, existing.dealerId);
  // Keep the process on its own dealer (no re-homing on update); the guard above authorized it.
  if (!existing.dealerId) {
    throw new AppError('This process is not linked to a dealer', StatusCodes.UNPROCESSABLE_ENTITY, 4226);
  }
  const process = await updateVehicleProcess(id, { ...body, dealerId: existing.dealerId });
  sendSuccess(res, 'Vehicle process updated', process);
}

export async function deleteVehicleProcessHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as VehicleProcessIdParams;
  const existing = await getVehicleProcessById(id);
  await assertManagedDealerMatches(req, existing.dealerId);
  await deleteVehicleProcess(id);
  sendSuccess(res, 'Vehicle process deleted', {});
}

