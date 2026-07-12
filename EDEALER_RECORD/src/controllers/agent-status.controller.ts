import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  syncAgentStatuses,
  getAgentStatusesByAgentId,
  updateAgentStatusOrder,
} from '../services/agent-status.service';
import { sendSuccess } from '../utils/api-response';
import { resolveAgentIdFromRequest } from '../utils/agent-scope';
import type {
  SyncAgentStatusesBody,
  AgentStatusesByAgentIdParams,
  UpdateAgentStatusOrderBody,
} from '../validations/agent-status.validation';

/**
 * POST /agent-statuses
 * Syncs all statuses for an agent based on the provided array.
 */
export async function syncAgentStatusesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as SyncAgentStatusesBody;
  const agentId = resolveAgentIdFromRequest(req, body.agentId);
  const statuses = await syncAgentStatuses({ ...body, agentId });
  sendSuccess(res, 'Agent statuses synced', statuses, StatusCodes.OK);
}

/**
 * GET /agent-statuses/:agentId
 * Returns all statuses for an agent ordered by statusRank.
 */
/**
 * GET /agent-statuses — statuses for the agent in the JWT (non-admin).
 */
export async function listAgentStatusesForSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const statuses = await getAgentStatusesByAgentId(agentId);
  sendSuccess(res, 'Agent statuses retrieved', statuses);
}

export async function getAgentStatusesByAgentIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { agentId } = req.params as unknown as AgentStatusesByAgentIdParams;
  const resolved = resolveAgentIdFromRequest(req, agentId);
  const statuses = await getAgentStatusesByAgentId(resolved);
  sendSuccess(res, 'Agent statuses retrieved', statuses);
}

/**
 * PUT /agent-statuses/order
 * Updates statusRank for multiple statuses for an agent.
 */
export async function updateAgentStatusOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as UpdateAgentStatusOrderBody;
  const agentId = resolveAgentIdFromRequest(req, body.agentId);
  const statuses = await updateAgentStatusOrder({ ...body, agentId });
  sendSuccess(res, 'Agent status order updated', statuses);
}
