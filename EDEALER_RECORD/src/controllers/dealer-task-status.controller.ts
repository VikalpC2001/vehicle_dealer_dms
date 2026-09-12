import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  syncDealerTaskStatuses,
  getDealerTaskStatusesByDealerId,
  updateDealerTaskStatusOrder,
} from '../services/dealer-task-status.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import { resolveManagedDealerId } from '../utils/managed-dealer-scope';
import type {
  SyncDealerTaskStatusesBody,
  DealerTaskStatusesByDealerIdParams,
  UpdateDealerTaskStatusOrderBody,
} from '../validations/dealer-task-status.validation';

/**
 * POST /dealer-task-statuses
 * Syncs all task statuses for a dealer based on the provided array.
 */
export async function syncDealerTaskStatusesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as SyncDealerTaskStatusesBody;
  // Agent-aware: a managing agent (or admin) may pass an explicit dealerId; a dealer uses their token.
  const dealerId = await resolveManagedDealerId(req, body.dealerId, { gateSubscription: false });
  const statuses = await syncDealerTaskStatuses({ ...body, dealerId });
  sendSuccess(res, 'Dealer task statuses synced', statuses, StatusCodes.OK);
}

/**
 * GET /dealer-task-statuses — task statuses for the dealer in the JWT (non-admin).
 */
export async function listDealerTaskStatusesForSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const dealerId = resolveDealerIdFromRequest(req);
  const statuses = await getDealerTaskStatusesByDealerId(dealerId);
  sendSuccess(res, 'Dealer task statuses retrieved', statuses);
}

/**
 * GET /dealer-task-statuses/:dealerId
 * Returns all task statuses for a dealer ordered by statusRank.
 */
export async function getDealerTaskStatusesByDealerIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { dealerId } = req.params as unknown as DealerTaskStatusesByDealerIdParams;
  const resolved = await resolveManagedDealerId(req, dealerId, { gateSubscription: false });
  const statuses = await getDealerTaskStatusesByDealerId(resolved);
  sendSuccess(res, 'Dealer task statuses retrieved', statuses);
}

/**
 * PUT /dealer-task-statuses/order
 * Updates statusRank for multiple task statuses for a dealer.
 */
export async function updateDealerTaskStatusOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as UpdateDealerTaskStatusOrderBody;
  const dealerId = await resolveManagedDealerId(req, body.dealerId, { gateSubscription: false });
  const statuses = await updateDealerTaskStatusOrder({ ...body, dealerId });
  sendSuccess(res, 'Dealer task status order updated', statuses);
}
