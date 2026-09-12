import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createDealerTag,
  listDealerTags,
  getDealerTagById,
  updateDealerTag,
  deleteDealerTag,
} from '../services/dealer-tag.service';
import { sendSuccess } from '../utils/api-response';
import { assertManagedDealerMatches, resolveManagedDealerId } from '../utils/managed-dealer-scope';
import type {
  CreateDealerTagBody,
  UpdateDealerTagBody,
  ListDealerTagsQuery,
  DealerTagIdParams,
} from '../validations/dealer-tag.validation';

/**
 * POST /dealer-tags
 * Creates a new tag for the resolved (managed) dealer.
 */
export async function createDealerTagHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateDealerTagBody;
  const dealerId = await resolveManagedDealerId(req, body.dealerId, { gateSubscription: false });
  const tag = await createDealerTag({ ...body, dealerId });
  sendSuccess(res, 'Dealer tag created', tag, StatusCodes.CREATED);
}

/**
 * GET /dealer-tags
 * Returns the resolved (managed) dealer's tags, ordered by tagName.
 */
export async function listDealerTagsHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as ListDealerTagsQuery;
  const dealerId = await resolveManagedDealerId(req, query.dealerId, { gateSubscription: false });
  const tags = await listDealerTags(dealerId);
  sendSuccess(res, 'Dealer tags retrieved', tags);
}

/**
 * PATCH /dealer-tags/:id
 * Updates a tag's name and/or colour after verifying it belongs to the caller's managed dealer.
 */
export async function updateDealerTagHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerTagIdParams;
  const body = req.body as UpdateDealerTagBody;
  const current = await getDealerTagById(id);
  await assertManagedDealerMatches(req, current.dealerId);
  const tag = await updateDealerTag(id, body);
  sendSuccess(res, 'Dealer tag updated', tag);
}

/**
 * DELETE /dealer-tags/:id
 * Deletes a tag after verifying it belongs to the caller's managed dealer. ProcessTag rows cascade.
 */
export async function deleteDealerTagHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerTagIdParams;
  const current = await getDealerTagById(id);
  await assertManagedDealerMatches(req, current.dealerId);
  await deleteDealerTag(id);
  sendSuccess(res, 'Dealer tag deleted', {});
}
