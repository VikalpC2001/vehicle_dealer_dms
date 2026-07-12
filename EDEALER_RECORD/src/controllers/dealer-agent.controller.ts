import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { grantAgent, listGrants, revokeGrant } from '../services/dealer-agent.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreateDealerAgentBody,
  DealerAgentIdParams,
} from '../validations/dealer-agent.validation';

/**
 * POST /dealer-agents
 * Grants agent-site access to an agent for the dealer in the JWT.
 */
export async function grantAgentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateDealerAgentBody;
  const dealerId = resolveDealerIdFromRequest(req);
  const result = await grantAgent(dealerId, body.agentId);
  sendSuccess(res, 'Agent access granted', result, StatusCodes.CREATED);
}

/**
 * GET /dealer-agents
 * Lists the active agent grants for the dealer in the JWT.
 */
export async function listDealerAgentsHandler(req: Request, res: Response): Promise<void> {
  const dealerId = resolveDealerIdFromRequest(req);
  const result = await listGrants(dealerId);
  sendSuccess(res, 'Dealer agent grants retrieved', result);
}

/**
 * DELETE /dealer-agents/:id
 * Revokes a dealer-agent grant owned by the dealer in the JWT.
 */
export async function revokeDealerAgentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as unknown as DealerAgentIdParams;
  const dealerId = resolveDealerIdFromRequest(req);
  const grant = await revokeGrant(dealerId, id);
  sendSuccess(res, 'Agent access revoked', grant);
}
