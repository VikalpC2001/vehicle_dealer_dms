import { prisma } from '../config/prisma';
import { DealerAgentStatus, DealerAgentSource } from '@prisma/client';
import type { Agent, DealerAgent } from '@prisma/client';

/**
 * Compact agent summary returned alongside a dealer-agent grant. Selects only the
 * fields needed to render an agent in the dealer's "granted agents" list.
 */
export type DealerAgentGrantAgentSummary = Pick<
  Agent,
  'agentId' | 'firmName' | 'agentName' | 'displayName' | 'mobileNo' | 'emailId'
>;

/**
 * A dealer-agent grant row joined with its compact agent summary.
 */
export type DealerAgentWithAgent = DealerAgent & {
  agent: DealerAgentGrantAgentSummary;
};

/** Fields selected for the nested agent summary on grant rows. */
const agentSummarySelect = {
  agentId: true,
  firmName: true,
  agentName: true,
  displayName: true,
  mobileNo: true,
  emailId: true,
} as const;

/**
 * Finds a dealer-agent grant by its (dealerId, agentId) unique pair.
 * Returns null when the dealer has never granted access to that agent.
 */
export async function findDealerAgent(
  dealerId: string,
  agentId: string,
): Promise<DealerAgent | null> {
  return prisma.dealerAgent.findUnique({
    where: { dealerId_agentId: { dealerId, agentId } },
  });
}

/**
 * Finds the dealer-agent grant for a (dealerId, agentId) pair, whatever its status (ACTIVE or
 * REVOKED), joined with the compact agent summary. Returns null when the dealer has never granted
 * access to that agent — the guard a dealer-scoped "work given to this agent" view relies on.
 */
export async function findDealerAgentWithAgent(
  dealerId: string,
  agentId: string,
): Promise<DealerAgentWithAgent | null> {
  return prisma.dealerAgent.findUnique({
    where: { dealerId_agentId: { dealerId, agentId } },
    include: { agent: { select: agentSummarySelect } },
  });
}

/**
 * Creates or refreshes a dealer-agent grant.
 *
 * Upserts on the `@@unique([dealerId, agentId])` constraint:
 * - When no row exists, creates one with `status = ACTIVE` and the given `source`.
 * - When a row already exists (e.g. previously REVOKED), updates it to
 *   `status = ACTIVE` and the given `source`.
 *
 * @param source - Origin of the grant (`DEALER_GRANT` for a dealer-initiated grant).
 */
export async function upsertGrant(
  dealerId: string,
  agentId: string,
  source: DealerAgentSource,
): Promise<DealerAgent> {
  return prisma.dealerAgent.upsert({
    where: { dealerId_agentId: { dealerId, agentId } },
    create: {
      dealerId,
      agentId,
      status: DealerAgentStatus.ACTIVE,
      source,
    },
    update: {
      status: DealerAgentStatus.ACTIVE,
      source,
    },
  });
}

/**
 * Lists all ACTIVE grants for a dealer, newest first, each with a compact agent
 * summary (agentId, firmName, agentName, displayName, mobileNo, emailId).
 */
export async function listActiveGrantsForDealer(
  dealerId: string,
): Promise<DealerAgentWithAgent[]> {
  return prisma.dealerAgent.findMany({
    where: { dealerId, status: DealerAgentStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
    include: { agent: { select: agentSummarySelect } },
  });
}

/**
 * Counts the dealer's ACTIVE, dealer-initiated grants. Used to evaluate the
 * dealer's `maxAgents` cap (CONNECT-sourced grants are excluded).
 */
export async function countActiveDealerGrants(dealerId: string): Promise<number> {
  return prisma.dealerAgent.count({
    where: {
      dealerId,
      status: DealerAgentStatus.ACTIVE,
      source: DealerAgentSource.DEALER_GRANT,
    },
  });
}

/**
 * Finds a single dealer-agent grant by its primary key. Returns null when absent.
 */
export async function findDealerAgentById(
  dealerAgentId: string,
): Promise<DealerAgent | null> {
  return prisma.dealerAgent.findUnique({
    where: { dealerAgentId },
  });
}

/**
 * Sets the status of a dealer-agent grant (e.g. to REVOKED on revocation).
 */
export async function setGrantStatus(
  dealerAgentId: string,
  status: DealerAgentStatus,
): Promise<DealerAgent> {
  return prisma.dealerAgent.update({
    where: { dealerAgentId },
    data: { status },
  });
}

/**
 * Finds an agent by ID. Kept local to this slice so the dealer-agent module
 * stays self-contained (does not depend on the agent repository).
 */
export async function findAgentById(agentId: string): Promise<Agent | null> {
  return prisma.agent.findUnique({
    where: { agentId },
  });
}

/** How an agent is authorized to manage a dealer's data (or `null` when not authorized). */
export type AgentDealerManagementMode = 'placeholder' | 'grant' | null;

/**
 * Determines whether — and how — an agent may manage a dealer's vehicle/RTO data:
 * - `'placeholder'`: the dealer is a placeholder the agent owns (independent management).
 * - `'grant'`: the dealer is a real dealer with an ACTIVE `DealerAgent` grant (either source).
 * - `null`: the agent is not authorized for this dealer.
 *
 * The two modes differ for subscription gating: independent placeholder management requires the
 * agent's own subscription, whereas a granted real dealer is covered by the dealer's subscription.
 */
export async function agentDealerManagementMode(
  agentId: string,
  dealerId: string,
): Promise<AgentDealerManagementMode> {
  const dealer = await prisma.dealer.findUnique({
    where: { dealerId },
    select: { isPlaceholder: true, ownerAgentId: true },
  });
  if (dealer?.isPlaceholder && dealer.ownerAgentId === agentId) return 'placeholder';

  const grant = await prisma.dealerAgent.findFirst({
    where: { dealerId, agentId, status: DealerAgentStatus.ACTIVE },
  });
  return grant ? 'grant' : null;
}

/**
 * Case-insensitive partial search over agents the dealer could grant access to.
 *
 * Matches `q` against email / mobile / whatsapp / agentName / firmName / displayName, and
 * EXCLUDES agents that are already an ACTIVE grant of the calling dealer (so the results are
 * only agents the dealer can newly add). Returns a compact agent summary, newest first.
 *
 * @param dealerId - The calling dealer (used to exclude already-active grants).
 * @param q - Search fragment (caller ensures a sensible minimum length).
 * @param take - Maximum number of results to return.
 */
export async function searchGrantableAgents(
  dealerId: string,
  q: string,
  take: number,
): Promise<DealerAgentGrantAgentSummary[]> {
  const contains = { contains: q, mode: 'insensitive' as const };
  return prisma.agent.findMany({
    where: {
      dealerAgents: { none: { dealerId, status: DealerAgentStatus.ACTIVE } },
      OR: [
        { emailId: contains },
        { mobileNo: contains },
        { whatsappNo: contains },
        { agentName: contains },
        { firmName: contains },
        { displayName: contains },
      ],
    },
    select: agentSummarySelect,
    orderBy: { createdAt: 'desc' },
    take,
  });
}
