import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createAgentWiseUser,
  createAgentWiseUserWithUser,
  listAgentWiseUsers,
  getAgentWiseUserById,
  updateAgentWiseUser,
  deleteAgentWiseUser,
} from '../services/agent-wise-user.service';
import { sendSuccess } from '../utils/api-response';
import { assertAgentMatchesToken, resolveAgentIdFromRequest } from '../utils/agent-scope';
import type {
  CreateAgentWiseUserBody,
  CreateAgentWiseUserWithUserBody,
  UpdateAgentWiseUserBody,
  AgentWiseUserIdParams,
} from '../validations/agent-wise-user.validation';

/**
 * POST /agent-wise-users
 */
export async function createAgentWiseUserHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateAgentWiseUserBody;
  const agentId = resolveAgentIdFromRequest(req, body.agentId);
  const row = await createAgentWiseUser({ ...body, agentId });
  sendSuccess(res, 'Agent user assignment created', row, StatusCodes.CREATED);
}

/**
 * POST /agent-wise-users/with-user
 */
export async function createAgentWiseUserWithUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CreateAgentWiseUserWithUserBody;
  const agentId = resolveAgentIdFromRequest(req, body.agentId);
  const row = await createAgentWiseUserWithUser({
    agentId,
    userName: body.userName,
    emailId: body.emailId,
    mobileNo: body.mobileNo,
    password: body.password,
  });
  sendSuccess(res, 'Agent user created and assigned', row, StatusCodes.CREATED);
}

/**
 * GET /agent-wise-users?agentId=
 */
export async function listAgentWiseUsersHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { agentId?: string };
  const agentId = resolveAgentIdFromRequest(req, q.agentId);
  const items = await listAgentWiseUsers(agentId);
  sendSuccess(res, 'Agent user assignments retrieved', items);
}

/**
 * GET /agent-wise-users/:id (`id` = `awuId`)
 */
export async function getAgentWiseUserByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as AgentWiseUserIdParams;
  const row = await getAgentWiseUserById(id);
  assertAgentMatchesToken(req, row.agentId);
  sendSuccess(res, 'Agent user assignment retrieved', row);
}

/**
 * PATCH /agent-wise-users/:id
 */
export async function updateAgentWiseUserHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as AgentWiseUserIdParams;
  const body = req.body as UpdateAgentWiseUserBody;
  const current = await getAgentWiseUserById(id);
  assertAgentMatchesToken(req, current.agentId);
  const row = await updateAgentWiseUser(id, body);
  sendSuccess(res, 'Agent user assignment updated', row);
}

/**
 * DELETE /agent-wise-users/:id
 */
export async function deleteAgentWiseUserHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as AgentWiseUserIdParams;
  const current = await getAgentWiseUserById(id);
  assertAgentMatchesToken(req, current.agentId);
  await deleteAgentWiseUser(id);
  sendSuccess(res, 'Agent user assignment deleted', {});
}
