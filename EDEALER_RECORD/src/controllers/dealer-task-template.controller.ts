import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createDealerTaskTemplate,
  listDealerTaskTemplates,
  getDealerTaskTemplateById,
  updateDealerTaskTemplate,
  deleteDealerTaskTemplate,
} from '../services/dealer-task-template.service';
import { sendSuccess } from '../utils/api-response';
import { assertManagedDealerMatches, resolveManagedDealerId } from '../utils/managed-dealer-scope';
import type {
  CreateDealerTaskTemplateBody,
  UpdateDealerTaskTemplateBody,
  DealerTaskTemplateIdParams,
} from '../validations/dealer-task-template.validation';
import type { PaginationQuery } from '../types';

/**
 * POST /dealer-task-templates
 * Creates a new dealer task template.
 */
export async function createDealerTaskTemplateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CreateDealerTaskTemplateBody;
  const dealerId = await resolveManagedDealerId(req, body.dealerId, { gateSubscription: false });
  const template = await createDealerTaskTemplate({ ...body, dealerId });
  sendSuccess(res, 'Dealer task template created', template, StatusCodes.CREATED);
}

/**
 * GET /dealer-task-templates
 * Returns a paginated list of dealer task templates for the resolved dealer.
 */
export async function listDealerTaskTemplatesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = req.query as unknown as PaginationQuery & { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, query.dealerId, { gateSubscription: false });
  const result = await listDealerTaskTemplates({ ...query, dealerId });
  sendSuccess(res, 'Dealer task templates retrieved', result);
}

/**
 * GET /dealer-task-templates/:id
 * Returns a single dealer task template by ID.
 */
export async function getDealerTaskTemplateByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerTaskTemplateIdParams;
  const template = await getDealerTaskTemplateById(id);
  await assertManagedDealerMatches(req, template.dealerId);
  sendSuccess(res, 'Dealer task template retrieved', template);
}

/**
 * PATCH /dealer-task-templates/:id
 * Updates an existing dealer task template.
 */
export async function updateDealerTaskTemplateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerTaskTemplateIdParams;
  const body = req.body as UpdateDealerTaskTemplateBody;
  const current = await getDealerTaskTemplateById(id);
  await assertManagedDealerMatches(req, current.dealerId);
  const template = await updateDealerTaskTemplate(id, body);
  sendSuccess(res, 'Dealer task template updated', template);
}

/**
 * DELETE /dealer-task-templates/:id
 * Deletes a dealer task template.
 */
export async function deleteDealerTaskTemplateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerTaskTemplateIdParams;
  const current = await getDealerTaskTemplateById(id);
  await assertManagedDealerMatches(req, current.dealerId);
  await deleteDealerTaskTemplate(id);
  sendSuccess(res, 'Dealer task template deleted', {});
}
