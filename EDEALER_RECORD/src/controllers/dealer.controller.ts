import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createDealer,
  listDealers,
  getDealerById,
  updateDealer,
  deleteDealer,
} from '../services/dealer.service';
import { sendSuccess } from '../utils/api-response';
import { assertOwnDealer, assertSuperAdmin } from '../utils/dealer-scope';
import type {
  CreateDealerBody,
  UpdateDealerBody,
  DealerIdParams,
} from '../validations/dealer.validation';
import type { PaginationQuery } from '../types';

/**
 * POST /dealers
 * Creates a new dealer. Super-admin only (a dealer cannot create dealers).
 */
export async function createDealerHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const body = req.body as CreateDealerBody;
  const dealer = await createDealer(body);
  sendSuccess(res, 'Dealer created', dealer, StatusCodes.CREATED);
}

/**
 * GET /dealers
 * Returns a paginated list of dealers. Super-admin only (dealers do not enumerate dealers).
 */
export async function listDealersHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const query = req.query as unknown as PaginationQuery;
  const result = await listDealers(query);
  sendSuccess(res, 'Dealers retrieved', result);
}

/**
 * GET /dealers/:id
 * Returns a single dealer by ID. A dealer user may only read their own dealer.
 */
export async function getDealerByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerIdParams;
  assertOwnDealer(req, id);
  const dealer = await getDealerById(id);
  sendSuccess(res, 'Dealer retrieved', dealer);
}

/**
 * PATCH /dealers/:id
 * Updates an existing dealer. A dealer user may only update their own dealer, and
 * cannot change `isSubscribe` (that is the super-admin's concern — preserved server-side).
 */
export async function updateDealerHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerIdParams;
  assertOwnDealer(req, id);
  const body = req.body as UpdateDealerBody;
  if (req.user.dealerId) {
    const existing = await getDealerById(id);
    body.isSubscribe = existing.isSubscribe;
  }
  const dealer = await updateDealer(id, body);
  sendSuccess(res, 'Dealer updated', dealer);
}

/**
 * DELETE /dealers/:id
 * Deletes a dealer. Super-admin only.
 */
export async function deleteDealerHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as DealerIdParams;
  await deleteDealer(id);
  sendSuccess(res, 'Dealer deleted', {});
}
