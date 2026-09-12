import type { Request, Response } from 'express';
import { getSwitchPreview, switchAgent } from '../services/dealer-agent-switch.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  SwitchPreviewQuery,
  SwitchAgentBody,
} from '../validations/dealer-agent-switch.validation';

/**
 * GET /dealer-agents/switch-preview?oldAgentId=
 * Returns the old agent's OPEN assignments + current ledger balance for the dealer to review.
 */
export async function switchPreviewHandler(req: Request, res: Response): Promise<void> {
  const { oldAgentId } = req.query as unknown as SwitchPreviewQuery;
  const dealerId = resolveDealerIdFromRequest(req);
  const preview = await getSwitchPreview(dealerId, oldAgentId);
  sendSuccess(res, 'Switch preview', preview);
}

/**
 * POST /dealer-agents/switch
 * Atomically switches the dealer off an agent (optionally onto a replacement), settling or keeping
 * the ledger and completing the old agent's open work.
 */
export async function switchAgentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as SwitchAgentBody;
  const dealerId = resolveDealerIdFromRequest(req);
  const result = await switchAgent(dealerId, req.user.sub, {
    oldAgentId: body.oldAgentId,
    newAgentId: body.newAgentId,
    settleDecision: body.settleDecision,
    settleAmount: body.settleAmount,
  });
  sendSuccess(res, 'Agent switched', result);
}
