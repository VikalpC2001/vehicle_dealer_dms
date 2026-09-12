import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createUploadCategory,
  listUploadCategories,
  getUploadCategoryById,
  updateUploadCategory,
  deleteUploadCategory,
  updateUploadCategoryOrderRanks,
} from '../services/upload-category.service';
import { sendSuccess } from '../utils/api-response';
import { assertSuperAdmin } from '../utils/dealer-scope';
import type {
  CreateUploadCategoryBody,
  UpdateUploadCategoryBody,
  UploadCategoryIdParams,
  UpdateUploadCategoryOrderRanksBody,
} from '../validations/upload-category.validation';

/**
 * POST /upload-categories — super-admin only (master document-category catalog).
 */
export async function createUploadCategoryHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const body = req.body as CreateUploadCategoryBody;
  const row = await createUploadCategory(body);
  sendSuccess(res, 'Upload category created', row, StatusCodes.CREATED);
}

/**
 * GET /upload-categories
 */
export async function listUploadCategoriesHandler(_req: Request, res: Response): Promise<void> {
  const items = await listUploadCategories();
  sendSuccess(res, 'Upload categories retrieved', items);
}

/**
 * GET /upload-categories/:id
 */
export async function getUploadCategoryByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as UploadCategoryIdParams;
  const row = await getUploadCategoryById(id);
  sendSuccess(res, 'Upload category retrieved', row);
}

/**
 * PATCH /upload-categories/:id
 */
export async function updateUploadCategoryHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as UploadCategoryIdParams;
  const body = req.body as UpdateUploadCategoryBody;
  const row = await updateUploadCategory(id, body);
  sendSuccess(res, 'Upload category updated', row);
}

/**
 * DELETE /upload-categories/:id
 */
export async function deleteUploadCategoryHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as UploadCategoryIdParams;
  await deleteUploadCategory(id);
  sendSuccess(res, 'Upload category deleted', {});
}

/**
 * PUT /upload-categories/order
 */
export async function updateUploadCategoryOrderRanksHandler(
  req: Request,
  res: Response,
): Promise<void> {
  assertSuperAdmin(req);
  const body = req.body as UpdateUploadCategoryOrderRanksBody;
  const rows = await updateUploadCategoryOrderRanks(body);
  sendSuccess(res, 'Order ranks updated', rows);
}
