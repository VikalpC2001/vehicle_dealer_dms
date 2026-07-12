import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  syncDealerStatuses,
  getDealerStatusesByDealerId,
  updateDealerStatusOrder,
} from '../services/dealer-status.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  SyncDealerStatusesBody,
  DealerStatusesByDealerIdParams,
  UpdateDealerStatusOrderBody,
} from '../validations/dealer-status.validation';

/**
 * POST /dealer-statuses
 * Syncs all statuses for a dealer based on the provided array.
 */
export async function syncDealerStatusesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as SyncDealerStatusesBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const statuses = await syncDealerStatuses({ ...body, dealerId });
  sendSuccess(res, 'Dealer statuses synced', statuses, StatusCodes.OK);
}

/**
 * GET /dealer-statuses/:dealerId
 * Returns all statuses for a dealer ordered by statusRank.
 */
/**
 * GET /dealer-statuses — statuses for the dealer in the JWT (non-admin).
 */
export async function listDealerStatusesForSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const dealerId = resolveDealerIdFromRequest(req);
  const statuses = await getDealerStatusesByDealerId(dealerId);
  sendSuccess(res, 'Dealer statuses retrieved', statuses);
}

export async function getDealerStatusesByDealerIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { dealerId } = req.params as unknown as DealerStatusesByDealerIdParams;
  const resolved = resolveDealerIdFromRequest(req, dealerId);
  const statuses = await getDealerStatusesByDealerId(resolved);
  sendSuccess(res, 'Dealer statuses retrieved', statuses);
}

/**
 * PUT /dealer-statuses/order
 * Updates statusRank for multiple statuses for a dealer.
 */
export async function updateDealerStatusOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as UpdateDealerStatusOrderBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const statuses = await updateDealerStatusOrder({ ...body, dealerId });
  sendSuccess(res, 'Dealer status order updated', statuses);
}
