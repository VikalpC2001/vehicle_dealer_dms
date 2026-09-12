import type { Request } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from './app-error';
import { agentDealerManagementMode, findAgentById } from '../repositories/dealer-agent.repository';
import { findAssignmentForProcessAgent } from '../repositories/process-assignment.repository';

/**
 * Unified authorization for "the dealer whose vehicle/RTO data I'm operating on", spanning BOTH
 * personas so an agent can manage data independently — not only a dealer.
 *
 * Callers:
 * - **super-admin** (`isSuperAdmin`): must pass an explicit `dealerId`; any dealer is allowed.
 * - **dealer** (token `dealerId`): their own dealer; an explicit value must match (`4032`).
 * - **agent** (token `agentId`): must pass an explicit `dealerId` they manage — a placeholder they
 *   own, or a real dealer with an ACTIVE grant. A placeholder (independent management) additionally
 *   requires the agent's own subscription (`Agent.isSubscribe`); a granted real dealer is covered by
 *   the dealer's subscription. See {@link agentDealerManagementMode}.
 *
 * Async because the agent branch checks ownership/grant (and subscription) in the DB.
 *
 * @throws AppError 4226 (super-admin without dealerId / agent without dealerId),
 *   4032 (dealer mismatch), 4033 (unlinked), 4039 (agent not authorized for the dealer),
 *   4020 (agent subscription required for independent placeholder management).
 */
export async function resolveManagedDealerId(
  req: Request,
  explicit?: string | null,
  opts?: { gateSubscription?: boolean },
): Promise<string> {
  const client = explicit?.trim() || undefined;
  const gateSubscription = opts?.gateSubscription ?? true;

  if (req.user.isSuperAdmin) {
    if (!client) {
      throw new AppError(
        'dealerId is required in the request for this role',
        StatusCodes.UNPROCESSABLE_ENTITY,
        4226,
      );
    }
    return client;
  }

  const tokenDealerId = req.user.dealerId ?? null;
  if (tokenDealerId) {
    if (client && client !== tokenDealerId) {
      throw new AppError('dealerId does not match your session', StatusCodes.FORBIDDEN, 4032);
    }
    return tokenDealerId;
  }

  const tokenAgentId = req.user.agentId ?? null;
  if (tokenAgentId) {
    if (!client) {
      throw new AppError(
        'dealerId is required — choose the dealer to manage',
        StatusCodes.UNPROCESSABLE_ENTITY,
        4226,
      );
    }
    const mode = await agentDealerManagementMode(tokenAgentId, client);
    if (!mode) {
      throw new AppError('You do not manage this dealer', StatusCodes.FORBIDDEN, 4039);
    }
    if (mode === 'placeholder' && gateSubscription) {
      await assertAgentSubscribed(tokenAgentId);
    }
    return client;
  }

  throw new AppError('Your account is not linked to a dealer or agent', StatusCodes.FORBIDDEN, 4033);
}

/**
 * Read-after-fetch guard: ensures the caller may act on a resource owned by `entityDealerId`.
 * Dealer-owner or managing-agent (owned placeholder / active grant) pass; super-admin bypasses.
 *
 * @throws AppError 4033 (unlinked), 4039 (agent not authorized), 4034 (dealer mismatch).
 */
export async function assertManagedDealerMatches(
  req: Request,
  entityDealerId: string | null | undefined,
): Promise<void> {
  if (req.user.isSuperAdmin) return;

  if (req.user.dealerId) {
    if (!entityDealerId || entityDealerId !== req.user.dealerId) {
      throw new AppError('You do not have access to this resource', StatusCodes.FORBIDDEN, 4034);
    }
    return;
  }

  const tokenAgentId = req.user.agentId ?? null;
  if (tokenAgentId) {
    if (!entityDealerId) {
      throw new AppError('You do not manage this dealer', StatusCodes.FORBIDDEN, 4039);
    }
    const mode = await agentDealerManagementMode(tokenAgentId, entityDealerId);
    if (!mode) {
      throw new AppError('You do not manage this dealer', StatusCodes.FORBIDDEN, 4039);
    }
    return;
  }

  throw new AppError('Your account is not linked to a dealer or agent', StatusCodes.FORBIDDEN, 4033);
}

/**
 * Guards access to a vehicle process's shared comment thread. Passes for the dealer owner, the
 * managing agent (owned placeholder / active grant), and super-admin (via
 * {@link assertManagedDealerMatches}); additionally passes for a dealer-assigned agent whose
 * managing grant was later revoked but who still has a non-cancelled assignment for the process.
 *
 * @param req - The authenticated request.
 * @param process - The process to authorize (its `processId` and `dealerId`).
 * @throws AppError 4033/4034/4039 when the caller may not access the process.
 */
export async function assertCanAccessProcess(
  req: Request,
  process: { processId: string; dealerId: string | null | undefined },
): Promise<void> {
  try {
    await assertManagedDealerMatches(req, process.dealerId);
    return;
  } catch (err) {
    const tokenAgentId = req.user.agentId ?? null;
    if (tokenAgentId) {
      const assignment = await findAssignmentForProcessAgent(process.processId, tokenAgentId);
      if (assignment) return;
    }
    throw err;
  }
}

/**
 * Guards an agent-only write on a process (RTO receipt, RC-book tracking): passes for the agent who
 * works the process (manages its dealer OR has a non-cancelled assignment for it) and super-admin.
 * Dealers and unlinked users are rejected — these actions belong to the agent doing the RTO work.
 *
 * @param req - The authenticated request.
 * @param process - The process to authorize (its `processId` and `dealerId`).
 * @throws AppError 4063 when the caller is not an agent working this process (or super-admin).
 */
export async function assertAgentCanWriteProcess(
  req: Request,
  process: { processId: string; dealerId: string | null | undefined },
): Promise<void> {
  if (req.user.isSuperAdmin) return;

  const tokenAgentId = req.user.agentId ?? null;
  if (tokenAgentId) {
    const mode = process.dealerId
      ? await agentDealerManagementMode(tokenAgentId, process.dealerId)
      : null;
    if (mode) return;
    const assignment = await findAssignmentForProcessAgent(process.processId, tokenAgentId);
    if (assignment) return;
  }

  throw new AppError(
    'Only the agent working this process can do that',
    StatusCodes.FORBIDDEN,
    4063,
  );
}

/**
 * Enforces that the agent has an active subscription (`Agent.isSubscribe`). Gates independent
 * management (own placeholders). Super-admin and dealer callers are not subject to it.
 *
 * @throws AppError 4020 (402) when the agent has no active subscription.
 */
export async function assertAgentSubscribed(agentId: string): Promise<void> {
  const agent = await findAgentById(agentId);
  if (!agent?.isSubscribe) {
    throw new AppError(
      'An active agent subscription is required to manage your own dealers',
      StatusCodes.PAYMENT_REQUIRED,
      4020,
    );
  }
}
