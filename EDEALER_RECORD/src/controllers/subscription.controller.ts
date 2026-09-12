import type { Request, Response } from 'express';
import {
  setDealerSubscriptionState,
  setAgentSubscriptionState,
} from '../services/subscription.service';
import { sendSuccess } from '../utils/api-response';
import { assertSuperAdmin } from '../utils/dealer-scope';
import type {
  SetSubscriptionParams,
  SetSubscriptionBody,
} from '../validations/subscription.validation';

/**
 * PATCH /dealers/:id/subscription
 * Super-admin sets a dealer's subscription flag.
 */
export async function setDealerSubscriptionHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as SetSubscriptionParams;
  const { isSubscribe } = req.body as SetSubscriptionBody;
  const result = await setDealerSubscriptionState(id, isSubscribe);
  sendSuccess(res, 'Dealer subscription updated', result);
}

/**
 * PATCH /agents/:id/subscription
 * Super-admin sets an agent's subscription flag.
 */
export async function setAgentSubscriptionHandler(req: Request, res: Response): Promise<void> {
  assertSuperAdmin(req);
  const { id } = req.params as unknown as SetSubscriptionParams;
  const { isSubscribe } = req.body as SetSubscriptionBody;
  const result = await setAgentSubscriptionState(id, isSubscribe);
  sendSuccess(res, 'Agent subscription updated', result);
}
