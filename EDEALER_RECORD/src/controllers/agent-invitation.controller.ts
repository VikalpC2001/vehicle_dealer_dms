import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import * as agentInvitationService from '../services/agent-invitation.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreateAgentInvitationBody,
  AgentInvitationIdParams,
  AcceptInvitationTokenParams,
  AcceptInvitationBody,
} from '../validations/agent-invitation.validation';

/**
 * POST /agent-invitations
 * Dealer invites a brand-new agent by email (emails a single-use onboarding link).
 */
export async function createInvitationHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateAgentInvitationBody;
  const dealerId = resolveDealerIdFromRequest(req);
  const result = await agentInvitationService.createInvitation(dealerId, req.user.sub, body);
  sendSuccess(res, 'Invitation sent', result, StatusCodes.CREATED);
}

/**
 * GET /agent-invitations
 * Lists the calling dealer's pending invitations.
 */
export async function listInvitationsHandler(req: Request, res: Response): Promise<void> {
  const dealerId = resolveDealerIdFromRequest(req);
  const items = await agentInvitationService.listInvitations(dealerId);
  sendSuccess(res, 'Invitations retrieved', items);
}

/**
 * POST /agent-invitations/:id/resend
 * Regenerates the link + expiry of a pending invitation and re-sends the email.
 */
export async function resendInvitationHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as AgentInvitationIdParams;
  const dealerId = resolveDealerIdFromRequest(req);
  const result = await agentInvitationService.resendInvitation(dealerId, id);
  sendSuccess(res, 'Invitation re-sent', result);
}

/**
 * DELETE /agent-invitations/:id
 * Cancels a pending invitation (retained as CANCELLED).
 */
export async function cancelInvitationHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as AgentInvitationIdParams;
  const dealerId = resolveDealerIdFromRequest(req);
  const result = await agentInvitationService.cancelInvitation(dealerId, id);
  sendSuccess(res, 'Invitation cancelled', result);
}

/**
 * GET /agent-invitations/accept/:token (PUBLIC)
 * Validates the token and returns the onboarding prefill.
 */
export async function getInvitationPrefillHandler(req: Request, res: Response): Promise<void> {
  const { token } = req.params as unknown as AcceptInvitationTokenParams;
  const prefill = await agentInvitationService.getInvitationPrefill(token);
  sendSuccess(res, 'Invitation valid', prefill);
}

/**
 * POST /agent-invitations/accept/:token (PUBLIC)
 * Creates the agent account + login, auto-grants to the inviting dealer (cap permitting), and
 * returns a token bundle so the new agent is logged straight in.
 */
export async function acceptInvitationHandler(req: Request, res: Response): Promise<void> {
  const { token } = req.params as unknown as AcceptInvitationTokenParams;
  const body = req.body as AcceptInvitationBody;
  const result = await agentInvitationService.acceptInvitation(token, body);
  sendSuccess(res, 'Welcome aboard', result, StatusCodes.CREATED);
}
