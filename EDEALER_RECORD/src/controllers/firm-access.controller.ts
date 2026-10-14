import type { Request, Response } from 'express';
import { setDealerAccessState, setAgentAccessState } from '../services/firm-access.service';
import { sendSuccess } from '../utils/api-response';
import { assertSuperAdmin } from '../utils/dealer-scope';
import type { SetFirmAccessParams, SetFirmAccessBody } from '../validations/firm-access.validation';

/**
 * PATCH /dealers/:id/access
 * Super-admin pauses or resumes a dealer's access.
 */
export async function setDealerAccessHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as SetFirmAccessParams;
  const { isActive } = req.body as SetFirmAccessBody;
  const result = await setDealerAccessState(id, isActive);
  sendSuccess(res, 'Dealer access updated', result);
}

/**
 * PATCH /agents/:id/access
 * Super-admin pauses or resumes an agent's access.
 */
export async function setAgentAccessHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as SetFirmAccessParams;
  const { isActive } = req.body as SetFirmAccessBody;
  const result = await setAgentAccessState(id, isActive);
  sendSuccess(res, 'Agent access updated', result);
}
