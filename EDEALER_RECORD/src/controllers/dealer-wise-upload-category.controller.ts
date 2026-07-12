import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createDealerWiseUploadCategory,
  listDealerWiseUploadCategories,
  listDealerWiseUploadCategoriesViewInStep,
  getDealerWiseUploadCategoryById,
  updateDealerWiseUploadCategory,
  deleteDealerWiseUploadCategory,
  updateDealerWiseUploadOrderRanks,
} from '../services/dealer-wise-upload-category.service';
import { sendSuccess } from '../utils/api-response';
import { assertDealerMatchesToken, resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreateDealerWiseUploadCategoryBody,
  UpdateDealerWiseUploadCategoryBody,
  DealerWiseUploadCategoryIdParams,
  UpdateDealerWiseUploadOrderRanksBody,
} from '../validations/dealer-wise-upload-category.validation';

/**
 * POST /dealer-wise-upload-categories
 */
export async function createDealerWiseUploadCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CreateDealerWiseUploadCategoryBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const row = await createDealerWiseUploadCategory({ ...body, dealerId });
  sendSuccess(res, 'Dealer upload category link created', row, StatusCodes.CREATED);
}

/**
 * GET /dealer-wise-upload-categories?dealerId=
 */
export async function listDealerWiseUploadCategoriesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const q = req.query as { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  const data = await listDealerWiseUploadCategories(dealerId);
  sendSuccess(res, 'Dealer upload category links retrieved', data);
}

/**
 * GET /dealer-wise-upload-categories/view-in-step?dealerId=
 */
export async function listDealerWiseUploadCategoriesViewInStepHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const q = req.query as { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  const data = await listDealerWiseUploadCategoriesViewInStep(dealerId);
  sendSuccess(res, 'Dealer step-view upload category links retrieved', data);
}

/**
 * GET /dealer-wise-upload-categories/:id (`id` = `dwucId`)
 */
export async function getDealerWiseUploadCategoryByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerWiseUploadCategoryIdParams;
  const row = await getDealerWiseUploadCategoryById(id);
  assertDealerMatchesToken(req, row.dealerId);
  sendSuccess(res, 'Dealer upload category link retrieved', row);
}

/**
 * PATCH /dealer-wise-upload-categories/:id
 */
export async function updateDealerWiseUploadCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerWiseUploadCategoryIdParams;
  const body = req.body as UpdateDealerWiseUploadCategoryBody;
  const current = await getDealerWiseUploadCategoryById(id);
  assertDealerMatchesToken(req, current.dealerId);
  const row = await updateDealerWiseUploadCategory(id, body);
  sendSuccess(res, 'Dealer upload category link updated', row);
}

/**
 * DELETE /dealer-wise-upload-categories/:id
 */
export async function deleteDealerWiseUploadCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerWiseUploadCategoryIdParams;
  const current = await getDealerWiseUploadCategoryById(id);
  assertDealerMatchesToken(req, current.dealerId);
  await deleteDealerWiseUploadCategory(id);
  sendSuccess(res, 'Dealer upload category link deleted', {});
}

/**
 * PUT /dealer-wise-upload-categories/order
 */
export async function updateDealerWiseUploadOrderRanksHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as UpdateDealerWiseUploadOrderRanksBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const data = await updateDealerWiseUploadOrderRanks({
    dealerId,
    items: body.items,
  });
  sendSuccess(res, 'Order ranks updated', data);
}
