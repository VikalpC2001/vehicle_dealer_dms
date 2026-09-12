import { StatusCodes } from 'http-status-codes';
import {
  DealerAgentSource,
  DealerAgentStatus,
  RoleType,
} from '@prisma/client';
import type { DealerAgent, LedgerEntry } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';
import { settleAccountOnTx } from './khata.repository';
import { completeOpenAssignmentsForPair } from './process-assignment.repository';

/** Settlement choice made by the dealer during a switch. */
export type SettleDecision = 'SETTLE' | 'KEEP';

/** Input to the atomic agent-switch transaction. */
export interface SwitchAgentParams {
  dealerId: string;
  userId: string | null;
  oldAgentId: string;
  newAgentId?: string | null;
  settleDecision: SettleDecision;
  settleAmount?: number | null;
  maxAgents: number;
}

/** Result of an agent switch. */
export interface SwitchAgentResult {
  oldGrant: DealerAgent;
  newGrant: DealerAgent | null;
  completedCount: number;
  settledEntry: LedgerEntry | null;
}

/**
 * Atomically switches a dealer off an agent (optionally onto a replacement) in ONE transaction:
 *
 *   1. (SETTLE, balance ≠ 0) post a balancing "Settlement on agent switch" ledger entry.
 *   2. Complete every OPEN assignment the dealer gave the old agent.
 *   3. Revoke the old agent's grant.
 *   4. (replacement given) grant the new agent — after the revoke, so the cap counts the freed
 *      slot; rejects a target that is already an ACTIVE grant (4233) and enforces the cap (4231).
 *
 * Ordering matters: settle BEFORE revoke (the ledger is independent of the grant, and this keeps
 * the balancing entry associated with the still-active relationship), and grant AFTER revoke so the
 * net active grant count never transiently exceeds the cap.
 *
 * @throws AppError 404 (4040) old grant not ACTIVE · 404 (4044) replacement agent missing ·
 *   422 (4233) replacement already active · 422 (4231) cap reached after the switch.
 */
export async function switchAgentTx(params: SwitchAgentParams): Promise<SwitchAgentResult> {
  const { dealerId, userId, oldAgentId, newAgentId, settleDecision, settleAmount, maxAgents } =
    params;

  return prisma.$transaction(async (tx) => {
    const oldGrant = await tx.dealerAgent.findUnique({
      where: { dealerId_agentId: { dealerId, agentId: oldAgentId } },
    });
    if (!oldGrant || oldGrant.status !== DealerAgentStatus.ACTIVE) {
      throw new AppError('No active grant for this agent', StatusCodes.NOT_FOUND, 4040);
    }

    let settledEntry: LedgerEntry | null = null;
    if (settleDecision === 'SETTLE') {
      const account = await tx.khataAccount.findUnique({
        where: { dealerId_agentId: { dealerId, agentId: oldAgentId } },
      });
      if (account && account.balance.toNumber() !== 0) {
        const settled = await settleAccountOnTx(tx, {
          dealerId,
          agentId: oldAgentId,
          requestedAmount: settleAmount ?? null,
          postedByUserId: userId,
          postedByRole: RoleType.DEALER,
          note: 'Settlement on agent switch',
        });
        settledEntry = settled.entry;
      }
    }

    const completedCount = await completeOpenAssignmentsForPair(tx, dealerId, oldAgentId);

    const revokedOldGrant = await tx.dealerAgent.update({
      where: { dealerAgentId: oldGrant.dealerAgentId },
      data: { status: DealerAgentStatus.REVOKED },
    });

    let newGrant: DealerAgent | null = null;
    if (newAgentId) {
      const agent = await tx.agent.findUnique({ where: { agentId: newAgentId } });
      if (!agent) {
        throw new AppError('Replacement agent not found', StatusCodes.NOT_FOUND, 4044);
      }
      const existingNew = await tx.dealerAgent.findUnique({
        where: { dealerId_agentId: { dealerId, agentId: newAgentId } },
      });
      if (
        existingNew?.status === DealerAgentStatus.ACTIVE &&
        existingNew.source === DealerAgentSource.DEALER_GRANT
      ) {
        throw new AppError(
          'That agent is already one of your active agents',
          StatusCodes.UNPROCESSABLE_ENTITY,
          4233,
        );
      }
      const used = await tx.dealerAgent.count({
        where: {
          dealerId,
          status: DealerAgentStatus.ACTIVE,
          source: DealerAgentSource.DEALER_GRANT,
        },
      });
      if (used >= maxAgents) {
        throw new AppError(
          'Agent limit reached — ask an admin to raise your agent slots to add more',
          StatusCodes.UNPROCESSABLE_ENTITY,
          4231,
        );
      }
      newGrant = await tx.dealerAgent.upsert({
        where: { dealerId_agentId: { dealerId, agentId: newAgentId } },
        create: {
          dealerId,
          agentId: newAgentId,
          status: DealerAgentStatus.ACTIVE,
          source: DealerAgentSource.DEALER_GRANT,
        },
        update: {
          status: DealerAgentStatus.ACTIVE,
          source: DealerAgentSource.DEALER_GRANT,
        },
      });
    }

    return { oldGrant: revokedOldGrant, newGrant, completedCount, settledEntry };
  });
}
