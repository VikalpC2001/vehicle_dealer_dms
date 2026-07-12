import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createPlaceholder,
  listPlaceholders,
  updatePlaceholder,
  deletePlaceholder,
  connectPlaceholder,
  disconnectPlaceholder,
} from '../services/placeholder-dealer.service';
import { sendSuccess } from '../utils/api-response';
import { resolveAgentIdFromRequest } from '../utils/agent-scope';
import type {
  CreatePlaceholderBody,
  UpdatePlaceholderBody,
  UpdatePlaceholderParams,
  PlaceholderIdParams,
  ConnectParams,
  ConnectBody,
} from '../validations/placeholder-dealer.validation';

/**
 * POST /placeholder-dealers
 * Creates a name-only placeholder dealer owned by the calling agent.
 */
export async function createPlaceholderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const body = req.body as CreatePlaceholderBody;
  const placeholder = await createPlaceholder(agentId, body);
  sendSuccess(res, 'Placeholder dealer created', placeholder, StatusCodes.CREATED);
}

/**
 * GET /placeholder-dealers
 * Lists all placeholder dealers owned by the calling agent.
 */
export async function listPlaceholdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const placeholders = await listPlaceholders(agentId);
  sendSuccess(res, 'Placeholder dealers retrieved', placeholders);
}

/**
 * PATCH /placeholder-dealers/:id
 * Updates the name fields of a placeholder dealer owned by the calling agent.
 */
export async function updatePlaceholderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const { id } = req.params as unknown as UpdatePlaceholderParams;
  const body = req.body as UpdatePlaceholderBody;
  const placeholder = await updatePlaceholder(agentId, id, body);
  sendSuccess(res, 'Placeholder dealer updated', placeholder);
}

/**
 * DELETE /placeholder-dealers/:id
 * Deletes a placeholder dealer owned by the calling agent (blocked if it has processes).
 */
export async function deletePlaceholderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const { id } = req.params as unknown as PlaceholderIdParams;
  const placeholder = await deletePlaceholder(agentId, id);
  sendSuccess(res, 'Placeholder dealer deleted', placeholder);
}

/**
 * POST /placeholder-dealers/:id/connect
 * Connects a placeholder dealer to a real subscribed dealer.
 */
export async function connectPlaceholderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const { id } = req.params as unknown as ConnectParams;
  const body = req.body as ConnectBody;
  const placeholder = await connectPlaceholder(agentId, id, body.realDealerId);
  sendSuccess(res, 'Placeholder dealer connected', placeholder);
}

/**
 * POST /placeholder-dealers/:id/disconnect
 * Disconnects a placeholder dealer from its real dealer.
 */
export async function disconnectPlaceholderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const { id } = req.params as unknown as PlaceholderIdParams;
  const placeholder = await disconnectPlaceholder(agentId, id);
  sendSuccess(res, 'Placeholder dealer disconnected', placeholder);
}
