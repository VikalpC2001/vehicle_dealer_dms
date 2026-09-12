import type { Request, Response } from 'express';
import { raiseAgentSlots } from '../services/dealer-agent-slots.service';
import { sendSuccess } from '../utils/api-response';
import { assertSuperAdmin } from '../utils/dealer-scope';
import type {
  RaiseAgentSlotsParams,
  RaiseAgentSlotsBody,
} from '../validations/dealer-agent-slots.validation';

/**
 * PATCH /dealers/:id/agent-slots
 * Super-admin sets/raises a dealer's active-agent slot limit (the manual "addon" today).
 */
export async function raiseAgentSlotsHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as RaiseAgentSlotsParams;
  const body = req.body as RaiseAgentSlotsBody;
  const result = await raiseAgentSlots(id, {
    maxAgents: body.maxAgents,
    deltaSlots: body.deltaSlots,
  });
  sendSuccess(res, 'Agent slots updated', result);
}
