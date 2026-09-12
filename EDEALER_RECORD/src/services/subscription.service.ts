import { StatusCodes } from 'http-status-codes';
import { findDealerById, setDealerSubscription } from '../repositories/dealer.repository';
import { findAgentById, setAgentSubscription } from '../repositories/agent.repository';
import { AppError } from '../utils/app-error';

/** Result of a subscription toggle. */
export interface SubscriptionResult {
  id: string;
  isSubscribe: boolean;
}

/**
 * Sets a dealer's subscription flag (super-admin). A subscribed dealer gets the dealer site and can
 * be a connect target for agents.
 *
 * @throws AppError 404 (4043) when the dealer does not exist.
 */
export async function setDealerSubscriptionState(
  dealerId: string,
  isSubscribe: boolean,
): Promise<SubscriptionResult> {
  const dealer = await findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }
  const updated = await setDealerSubscription(dealerId, isSubscribe);
  return { id: dealer.dealerId, isSubscribe: updated.isSubscribe };
}

/**
 * Sets an agent's subscription flag (super-admin). A subscribed agent can independently manage
 * their own placeholder dealers' vehicle/RTO data + ledger.
 *
 * @throws AppError 404 (4044) when the agent does not exist.
 */
export async function setAgentSubscriptionState(
  agentId: string,
  isSubscribe: boolean,
): Promise<SubscriptionResult> {
  const agent = await findAgentById(agentId);
  if (!agent) {
    throw new AppError('Agent not found', StatusCodes.NOT_FOUND, 4044);
  }
  const updated = await setAgentSubscription(agentId, isSubscribe);
  return { id: agent.agentId, isSubscribe: updated.isSubscribe };
}
