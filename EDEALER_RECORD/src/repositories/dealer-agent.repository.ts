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
