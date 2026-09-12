import { StatusCodes } from 'http-status-codes';
import { findDealerById, setMaxAgents } from '../repositories/dealer.repository';
import * as dealerAgentRepository from '../repositories/dealer-agent.repository';
import { AppError } from '../utils/app-error';

export interface RaiseAgentSlotsInput {
  maxAgents?: number;
  deltaSlots?: number;
}

export interface AgentSlotsResult {
  dealerId: string;
  maxAgents: number;
  used: number;
}

/**
 * Sets/raises a dealer's active-agent slot limit (`maxAgents`). This is the SINGLE "raise slots"
 * seam: a super-admin calls it today; a future self-serve addon purchase calls the same function
 * (after payment) instead of the super-admin controller. Rejects a target below the dealer's
 * current active usage so existing agents are never invalidated.
 *
 * @param dealerId - The dealer whose limit is being set.
 * @param input - Either an absolute `maxAgents` or an additive `deltaSlots`.
 * @throws AppError 404 (4043) when the dealer does not exist.
 * @throws AppError 422 (4232) when the new limit would be below the dealer's active usage.
 */
export async function raiseAgentSlots(
  dealerId: string,
  input: RaiseAgentSlotsInput,
): Promise<AgentSlotsResult> {
  const dealer = await findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }
  const target = input.maxAgents ?? dealer.maxAgents + (input.deltaSlots ?? 0);
  const used = await dealerAgentRepository.countActiveDealerGrants(dealerId);
  if (target < used) {
    throw new AppError(
      `Cannot set the agent limit to ${target} — ${used} agents are already active`,
      StatusCodes.UNPROCESSABLE_ENTITY,
      4232,
    );
  }
  const updated = await setMaxAgents(dealerId, target);
  return { dealerId, maxAgents: updated.maxAgents, used };
}
