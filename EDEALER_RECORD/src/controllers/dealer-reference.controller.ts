import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createDealerReference,
  listDealerReferences,
  listDealerReferencesForDropdown,
  getDealerReferenceById,
  updateDealerReference,
  deleteDealerReference,
} from '../services/dealer-reference.service';
import { sendSuccess } from '../utils/api-response';
import { assertDealerMatchesToken, resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreateDealerReferenceBody,
  UpdateDealerReferenceBody,
  DealerReferenceIdParams,
} from '../validations/dealer-reference.validation';
import type { PaginationQuery } from '../types';

/**
 * POST /dealer-references
 * Creates a new dealer reference.
 */
export async function createDealerReferenceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CreateDealerReferenceBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const reference = await createDealerReference({ ...body, dealerId });
  sendSuccess(res, 'Dealer reference created', reference, StatusCodes.CREATED);
}

/**
 * GET /dealer-references
 * Returns a paginated list of dealer references (optionally filtered by dealer).
 */
export async function listDealerReferencesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = req.query as unknown as PaginationQuery & { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, query.dealerId);
  const result = await listDealerReferences({ ...query, dealerId });
  sendSuccess(res, 'Dealer references retrieved', result);
}

/**
 * GET /dealer-references/ddl
 * Returns all dealer references for dropdown (no pagination).
 */
export async function listDealerReferencesForDropdownHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = req.query as { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, query.dealerId);
  const items = await listDealerReferencesForDropdown(dealerId);
  sendSuccess(res, 'Dealer references retrieved', items);
}

/**
 * GET /dealer-references/:id
 * Returns a single dealer reference by ID.
 */
export async function getDealerReferenceByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerReferenceIdParams;
  const reference = await getDealerReferenceById(id);
  assertDealerMatchesToken(req, reference.dealerId);
  sendSuccess(res, 'Dealer reference retrieved', reference);
}

/**
 * PATCH /dealer-references/:id
 * Updates an existing dealer reference.
 */
export async function updateDealerReferenceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerReferenceIdParams;
  const body = req.body as UpdateDealerReferenceBody;
  const current = await getDealerReferenceById(id);
  assertDealerMatchesToken(req, current.dealerId);
  const reference = await updateDealerReference(id, body);
  sendSuccess(res, 'Dealer reference updated', reference);
}

/**
 * DELETE /dealer-references/:id
 * Deletes a dealer reference.
 */
export async function deleteDealerReferenceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerReferenceIdParams;
  const current = await getDealerReferenceById(id);
  assertDealerMatchesToken(req, current.dealerId);
  await deleteDealerReference(id);
  sendSuccess(res, 'Dealer reference deleted', {});
}

