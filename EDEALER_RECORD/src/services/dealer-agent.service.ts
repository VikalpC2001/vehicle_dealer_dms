import { StatusCodes } from 'http-status-codes';
import { DealerAgentSource, DealerAgentStatus } from '@prisma/client';
import type { DealerAgent } from '@prisma/client';
import * as dealerAgentRepository from '../repositories/dealer-agent.repository';
import type { DealerAgentWithAgent } from '../repositories/dealer-agent.repository';
import { findDealerById } from '../repositories/dealer.repository';
import { AppError } from '../utils/app-error';

/** Default agent cap applied when a dealer has no explicit `maxAgents` value. */
const DEFAULT_MAX_AGENTS = 2;

/**
 * Cap information surfaced to the dealer about their active grants.
 * `overCap` is informational only — grants are never blocked here (Phase 4).
 */
export interface DealerAgentCapInfo {
  maxAgents: number;
  used: number;
  overCap: boolean;
}

/**
 * Result of granting agent-site access: the (created or refreshed) grant plus
 * the dealer's current cap usage.
 */
export interface GrantAgentResult {
  grant: DealerAgent;
  capInfo: DealerAgentCapInfo;
}

/**
 * Result of listing a dealer's active grants: the agent rows plus cap usage.
 */
export interface ListGrantsResult {
  items: DealerAgentWithAgent[];
  capInfo: DealerAgentCapInfo;
}

/**
 * Computes the dealer's current agent-cap usage. `maxAgents` falls back to
 * {@link DEFAULT_MAX_AGENTS} when the dealer has no explicit value; `used` counts
 * ACTIVE dealer-initiated grants; `overCap` is true when usage exceeds the cap.
 */
async function buildCapInfo(dealerId: string): Promise<DealerAgentCapInfo> {
  const dealer = await findDealerById(dealerId);
  const maxAgents = dealer?.maxAgents ?? DEFAULT_MAX_AGENTS;
  const used = await dealerAgentRepository.countActiveDealerGrants(dealerId);
  return { maxAgents, used, overCap: used > maxAgents };
}

/**
 * Grants agent-site access from the calling dealer to an agent.
 *
 * Asserts the agent exists, then upserts an ACTIVE `DEALER_GRANT` grant
 * (re-activating a previously revoked row if present). Does NOT block when the
 * dealer is over their `maxAgents` cap — the returned `capInfo.overCap` flag only
 * surfaces the condition for the UI to act on later.
 *
 * @throws AppError 404 (4044) when the agent does not exist.
 */
export async function grantAgent(
  dealerId: string,
  agentId: string,
): Promise<GrantAgentResult> {
  const agent = await dealerAgentRepository.findAgentById(agentId);
  if (!agent) {
    throw new AppError('Agent not found', StatusCodes.NOT_FOUND, 4044);
  }

  const grant = await dealerAgentRepository.upsertGrant(
    dealerId,
    agentId,
    DealerAgentSource.DEALER_GRANT,
  );

  const capInfo = await buildCapInfo(dealerId);
  return { grant, capInfo };
}

/**
 * Returns the dealer's ACTIVE grants (each with a compact agent summary) plus the
 * dealer's current cap usage.
 */
export async function listGrants(dealerId: string): Promise<ListGrantsResult> {
  const items = await dealerAgentRepository.listActiveGrantsForDealer(dealerId);
  const capInfo = await buildCapInfo(dealerId);
  return { items, capInfo };
}

/**
 * Revokes a dealer-agent grant for the calling dealer.
 *
 * Loads the grant, enforces that it belongs to the caller's dealer, then sets its
 * status to REVOKED.
 *
 * @param dealerId - The resolved dealer id of the caller (from the request token).
 * @param dealerAgentId - The grant to revoke.
 * @throws AppError 404 (4040) when the grant does not exist.
 * @throws AppError 403 (4034) when the grant belongs to a different dealer.
 */
export async function revokeGrant(
  dealerId: string,
  dealerAgentId: string,
): Promise<DealerAgent> {
  const grant = await dealerAgentRepository.findDealerAgentById(dealerAgentId);
  if (!grant) {
    throw new AppError('Dealer-agent grant not found', StatusCodes.NOT_FOUND, 4040);
  }

  if (grant.dealerId !== dealerId) {
    throw new AppError(
      'You do not have access to this resource',
      StatusCodes.FORBIDDEN,
      4034,
    );
  }

  return dealerAgentRepository.setGrantStatus(dealerAgentId, DealerAgentStatus.REVOKED);
}
