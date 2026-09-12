import { StatusCodes } from 'http-status-codes';
import { DealerAgentStatus } from '@prisma/client';
import type { DealerAgent, LedgerDirection } from '@prisma/client';
import * as dealerAgentRepository from '../repositories/dealer-agent.repository';
import * as processAssignmentRepository from '../repositories/process-assignment.repository';
import { findAccount } from '../repositories/khata.repository';
import { findDealerById } from '../repositories/dealer.repository';
import { switchAgentTx } from '../repositories/dealer-agent-switch.repository';
import type { SettleDecision } from '../repositories/dealer-agent-switch.repository';
import type { OpenAssignmentForPair } from '../repositories/process-assignment.repository';
import { DEFAULT_MAX_AGENTS } from './dealer-agent.service';
import { AppError } from '../utils/app-error';

/** What the dealer sees before confirming a switch: the old agent's open work + ledger balance. */
export interface SwitchPreview {
  agentId: string;
  openAssignmentCount: number;
  openAssignments: OpenAssignmentForPair[];
  /** Dealer-perspective balance as a string (Decimal). Positive = dealer owes the agent. */
  balance: string;
  hasBalance: boolean;
}

/**
 * Builds the pre-switch preview for a dealer's currently-active agent: the OPEN assignments that
 * would be auto-completed and the current khata balance that can be settled or kept open.
 *
 * @throws AppError 404 (4040) when the agent is not an active grant of the dealer.
 */
export async function getSwitchPreview(
  dealerId: string,
  oldAgentId: string,
): Promise<SwitchPreview> {
  const grant = await dealerAgentRepository.findDealerAgent(dealerId, oldAgentId);
  if (!grant || grant.status !== DealerAgentStatus.ACTIVE) {
    throw new AppError('No active grant for this agent', StatusCodes.NOT_FOUND, 4040);
  }

  const [openAssignments, account] = await Promise.all([
    processAssignmentRepository.listOpenAssignmentsForPair(dealerId, oldAgentId),
    findAccount(dealerId, oldAgentId),
  ]);

  const balance = account?.balance?.toString() ?? '0';
  return {
    agentId: oldAgentId,
    openAssignmentCount: openAssignments.length,
    openAssignments,
    balance,
    hasBalance: account ? account.balance.toNumber() !== 0 : false,
  };
}

/** Input for {@link switchAgent} (already validated by the route). */
export interface SwitchAgentInput {
  oldAgentId: string;
  newAgentId?: string;
  settleDecision: SettleDecision;
  settleAmount?: number;
}

/** Serializable summary of the settlement entry posted during a switch (no Decimal/BigInt). */
export interface SwitchSettledEntry {
  ledgerEntryId: string;
  direction: LedgerDirection;
  amount: number;
  balanceAfter: number;
  description: string | null;
}

/** Serializable result of a switch (grants carry no Decimal/BigInt; the entry is flattened). */
export interface SwitchAgentResponse {
  oldGrant: DealerAgent;
  newGrant: DealerAgent | null;
  completedCount: number;
  settledEntry: SwitchSettledEntry | null;
}

/**
 * Switches a dealer off an agent (optionally onto a replacement), settling or keeping the ledger
 * and completing the old agent's open work — all atomically (see
 * {@link switchAgentTx}). The dealer's cap is read here and enforced post-revoke inside the tx.
 *
 * @throws AppError 400 (4000) when old and new agent are the same.
 */
export async function switchAgent(
  dealerId: string,
  userId: string | null,
  input: SwitchAgentInput,
): Promise<SwitchAgentResponse> {
  if (input.newAgentId && input.newAgentId === input.oldAgentId) {
    throw new AppError(
      'The replacement agent must be different from the current agent',
      StatusCodes.BAD_REQUEST,
      4000,
    );
  }

  const dealer = await findDealerById(dealerId);
  const maxAgents = dealer?.maxAgents ?? DEFAULT_MAX_AGENTS;

  const result = await switchAgentTx({
    dealerId,
    userId,
    oldAgentId: input.oldAgentId,
    newAgentId: input.newAgentId ?? null,
    settleDecision: input.settleDecision,
    settleAmount: input.settleAmount ?? null,
    maxAgents,
  });

  return {
    oldGrant: result.oldGrant,
    newGrant: result.newGrant,
    completedCount: result.completedCount,
    settledEntry: result.settledEntry
      ? {
          ledgerEntryId: result.settledEntry.ledgerEntryId,
          direction: result.settledEntry.direction,
          amount: result.settledEntry.amount.toNumber(),
          balanceAfter: result.settledEntry.balanceAfter.toNumber(),
          description: result.settledEntry.description,
        }
      : null,
  };
}
