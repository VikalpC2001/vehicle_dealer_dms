import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createAgent,
  listAgents,
  getAgentById,
  updateAgent,
  updateMyAgentProfile,
  deleteAgent,
} from '../services/agent.service';
import { createAgentWiseUserWithUser } from '../services/agent-wise-user.service';
import { resolveAgentIdFromRequest } from '../utils/agent-scope';
import { assertSuperAdmin } from '../utils/dealer-scope';
import { sendSuccess } from '../utils/api-response';
import type {
  CreateAgentBody,
  UpdateAgentBody,
  UpdateMyAgentBody,
  AgentIdParams,
  CreateAgentWithUserBody,
} from '../validations/agent.validation';
import type { PaginationQuery } from '../types';

/**
 * POST /agents
 * Creates a new agent.
 */
export async function createAgentHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const body = req.body as CreateAgentBody;
  const agent = await createAgent(body);
  sendSuccess(res, 'Agent created', agent, StatusCodes.CREATED);
}

/**
 * POST /agents/with-user
 * Creates a verified user and links them to an agent (super-admin onboarding of an agent owner).
 * Unscoped like POST /agents — `agentId` comes from the body.
 */
export async function createAgentWithUserHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const body = req.body as CreateAgentWithUserBody;
  const link = await createAgentWiseUserWithUser(body);
  sendSuccess(res, 'Agent user created', link, StatusCodes.CREATED);
}

/**
 * GET /agents
 * Returns a paginated list of agents.
 */
export async function listAgentsHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PaginationQuery;
  const result = await listAgents(query);
  sendSuccess(res, 'Agents retrieved', result);
}

/**
 * GET /agents/me
 * Returns the caller agent's own profile (resolved from the token; 4035 if not an agent).
 */
export async function getMyAgentHandler(req: Request, res: Response): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const agent = await getAgentById(agentId);
  sendSuccess(res, 'Agent profile retrieved', agent);
}

/**
 * PATCH /agents/me
 * The agent edits their OWN profile. `isSubscribe` is preserved (super-admin's), never taken from
 * the body, so an agent cannot self-subscribe here.
 */
export async function updateMyAgentHandler(req: Request, res: Response): Promise<void> {
  const agentId = resolveAgentIdFromRequest(req);
  const body = req.body as UpdateMyAgentBody;
  const agent = await updateMyAgentProfile(agentId, body);
  sendSuccess(res, 'Profile updated', agent);
}

/**
 * GET /agents/:id
 * Returns a single agent by ID.
 */
export async function getAgentByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as AgentIdParams;
  const agent = await getAgentById(id);
  sendSuccess(res, 'Agent retrieved', agent);
}

/**
 * PATCH /agents/:id
 * Updates an existing agent.
 */
export async function updateAgentHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as AgentIdParams;
  const body = req.body as UpdateAgentBody;
  const agent = await updateAgent(id, body);
  sendSuccess(res, 'Agent updated', agent);
}

/**
 * DELETE /agents/:id
 * Deletes an agent.
 */
export async function deleteAgentHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as AgentIdParams;
  await deleteAgent(id);
  sendSuccess(res, 'Agent deleted', {});
}
