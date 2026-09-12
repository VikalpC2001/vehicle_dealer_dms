import { StatusCodes } from 'http-status-codes';
import { DealerAgentSource, DealerAgentStatus } from '@prisma/client';
import type { DealerAgent } from '@prisma/client';
import * as dealerAgentRepository from '../repositories/dealer-agent.repository';
import type {
  DealerAgentWithAgent,
  DealerAgentGrantAgentSummary,
} from '../repositories/dealer-agent.repository';
import { findDealerById } from '../repositories/dealer.repository';
import { AppError } from '../utils/app-error';

/** Default agent cap applied when a dealer has no explicit `maxAgents` value. */
export const DEFAULT_MAX_AGENTS = 2;

/** Maximum agent-search results returned to the Add-Agent dialog. */
const AGENT_SEARCH_LIMIT = 10;

/**
 * Cap information surfaced to the dealer about their active grants. `overCap` is informational;
 * `hasFreeSlot` (`used < maxAgents`) drives the UI's add/invite affordances. The cap is ENFORCED
 * by {@link assertCapHasFreeSlot} on any action that newly consumes a slot.
 */
export interface DealerAgentCapInfo {
  maxAgents: number;
  used: number;
  overCap: boolean;
  hasFreeSlot: boolean;
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
  return { maxAgents, used, overCap: used > maxAgents, hasFreeSlot: used < maxAgents };
}

/**
 * Enforces the dealer's active-agent cap. Throws 4231 when there is no free slot
 * (`used >= maxAgents`, counting ACTIVE `DEALER_GRANT` grants). Call before any action that
 * newly consumes a slot (a fresh direct grant, an invite acceptance). The switch flow frees a
 * slot first (revoke) and re-checks post-revoke inside its transaction.
 *
 * @throws AppError 422 (4231) when the dealer is at their agent limit.
 */
export async function assertCapHasFreeSlot(dealerId: string): Promise<void> {
  const dealer = await findDealerById(dealerId);
  const maxAgents = dealer?.maxAgents ?? DEFAULT_MAX_AGENTS;
  const used = await dealerAgentRepository.countActiveDealerGrants(dealerId);
  if (used >= maxAgents) {
    throw new AppError(
      'Agent limit reached — ask an admin to raise your agent slots to add more',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4231,
    );
  }
}

/**
 * Grants agent-site access from the calling dealer to an agent.
 *
 * Asserts the agent exists, then upserts an ACTIVE `DEALER_GRANT` grant
 * (re-activating a previously revoked row if present). Enforces the dealer's `maxAgents` cap
 * (4231) — but only when the grant would newly consume a slot; re-granting an agent that is
 * already an ACTIVE `DEALER_GRANT` is idempotent and never blocked.
 *
 * @throws AppError 404 (4044) when the agent does not exist.
 * @throws AppError 422 (4231) when the dealer is at their agent limit.
 */
export async function grantAgent(
  dealerId: string,
  agentId: string,
): Promise<GrantAgentResult> {
  const agent = await dealerAgentRepository.findAgentById(agentId);
  if (!agent) {
    throw new AppError('Agent not found', StatusCodes.NOT_FOUND, 4044);
  }

  const existing = await dealerAgentRepository.findDealerAgent(dealerId, agentId);
  const alreadyCounts =
    existing?.status === DealerAgentStatus.ACTIVE &&
    existing.source === DealerAgentSource.DEALER_GRANT;
  if (!alreadyCounts) {
    await assertCapHasFreeSlot(dealerId);
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
 * Searches agents the calling dealer could grant access to (partial, case-insensitive match on
 * email / mobile / whatsapp / agentName / firmName / displayName), excluding agents already an
 * ACTIVE grant of this dealer. The search fragment is validated (min length) at the route; this
 * trims and caps the result count.
 *
 * @param dealerId - The calling dealer.
 * @param q - Search fragment.
 */
export async function searchGrantableAgents(
  dealerId: string,
  q: string,
): Promise<DealerAgentGrantAgentSummary[]> {
  return dealerAgentRepository.searchGrantableAgents(dealerId, q.trim(), AGENT_SEARCH_LIMIT);
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
