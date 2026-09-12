import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createAgentWiseUploadCategory,
  listAgentWiseUploadCategories,
  listAgentWiseUploadCategoriesViewInStep,
  getAgentWiseUploadCategoryById,
  updateAgentWiseUploadCategory,
  deleteAgentWiseUploadCategory,
  updateAgentWiseUploadOrderRanks,
} from '../services/agent-wise-upload-category.service';
import { sendSuccess } from '../utils/api-response';
import { assertAgentMatchesToken, resolveAgentIdFromRequest } from '../utils/agent-scope';
import type {
  CreateAgentWiseUploadCategoryBody,
  UpdateAgentWiseUploadCategoryBody,
  AgentWiseUploadCategoryIdParams,
  UpdateAgentWiseUploadOrderRanksBody,
} from '../validations/agent-wise-upload-category.validation';

/**
 * POST /agent-wise-upload-categories
 */
export async function createAgentWiseUploadCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CreateAgentWiseUploadCategoryBody;
  const agentId = resolveAgentIdFromRequest(req, body.agentId);
  const row = await createAgentWiseUploadCategory({ ...body, agentId });
  sendSuccess(res, 'Agent upload category link created', row, StatusCodes.CREATED);
}

/**
 * GET /agent-wise-upload-categories?agentId=
 */
export async function listAgentWiseUploadCategoriesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const q = req.query as { agentId?: string };
  const agentId = resolveAgentIdFromRequest(req, q.agentId);
  const data = await listAgentWiseUploadCategories(agentId);
  sendSuccess(res, 'Agent upload category links retrieved', data);
}

/**
 * GET /agent-wise-upload-categories/view-in-step?agentId=
 */
export async function listAgentWiseUploadCategoriesViewInStepHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const q = req.query as { agentId?: string };
  const agentId = resolveAgentIdFromRequest(req, q.agentId);
  const data = await listAgentWiseUploadCategoriesViewInStep(agentId);
  sendSuccess(res, 'Agent step-view upload category links retrieved', data);
}

/**
 * GET /agent-wise-upload-categories/:id (`id` = `awucId`)
 */
export async function getAgentWiseUploadCategoryByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as AgentWiseUploadCategoryIdParams;
  const row = await getAgentWiseUploadCategoryById(id);
  assertAgentMatchesToken(req, row.agentId);
  sendSuccess(res, 'Agent upload category link retrieved', row);
}

/**
 * PATCH /agent-wise-upload-categories/:id
 */
export async function updateAgentWiseUploadCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as AgentWiseUploadCategoryIdParams;
  const body = req.body as UpdateAgentWiseUploadCategoryBody;
  const current = await getAgentWiseUploadCategoryById(id);
  assertAgentMatchesToken(req, current.agentId);
  const row = await updateAgentWiseUploadCategory(id, body);
  sendSuccess(res, 'Agent upload category link updated', row);
}

/**
 * DELETE /agent-wise-upload-categories/:id
 */
export async function deleteAgentWiseUploadCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as AgentWiseUploadCategoryIdParams;
  const current = await getAgentWiseUploadCategoryById(id);
  assertAgentMatchesToken(req, current.agentId);
  await deleteAgentWiseUploadCategory(id);
  sendSuccess(res, 'Agent upload category link deleted', {});
}

/**
 * PUT /agent-wise-upload-categories/order
 */
export async function updateAgentWiseUploadOrderRanksHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as UpdateAgentWiseUploadOrderRanksBody;
  const agentId = resolveAgentIdFromRequest(req, body.agentId);
  const data = await updateAgentWiseUploadOrderRanks({
    agentId,
    items: body.items,
  });
  sendSuccess(res, 'Order ranks updated', data);
}
