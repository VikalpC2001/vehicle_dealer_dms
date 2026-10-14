import type { ApprovalStatus } from '@prisma/client';
import type { Role } from '../types';
import { signAccessToken } from '../utils/jwt';
import { getPrimaryDealerIdForUser, isDealerOwnerUser } from './dealer-wise-user.service';
import { getPrimaryAgentIdForUser } from './agent-wise-user.service';
import { findDealerById } from '../repositories/dealer.repository';
import { findAgentById } from '../repositories/agent.repository';
import * as userRepository from '../repositories/user.repository';
import { buildFirmAccessPausedError } from './firm-access.service';

/**
 * The linked firm's approval state + reason (defaults APPROVED when there is no firm) and its
 * super-admin access switch (`isActive`; defaults true when there is no firm).
 */
export interface FirmApproval {
  approvalStatus: ApprovalStatus;
  approvalReason: string | null;
  isActive: boolean;
}

/**
 * Resolves the approval state and access switch of the user's linked firm (a user has at most one
 * dealer OR agent), read fresh from the firm row. A super-admin / unlinked user — or a firm row
 * that no longer exists — resolves to APPROVED and active.
 */
export async function resolveFirmApproval(
  dealerId: string | null,
  agentId: string | null,
): Promise<FirmApproval> {
  if (dealerId) {
    const dealer = await findDealerById(dealerId);
    return {
      approvalStatus: dealer?.approvalStatus ?? 'APPROVED',
      approvalReason: dealer?.approvalReason ?? null,
      isActive: dealer?.isActive ?? true,
    };
  }
  if (agentId) {
    const agent = await findAgentById(agentId);
    return {
      approvalStatus: agent?.approvalStatus ?? 'APPROVED',
      approvalReason: agent?.approvalReason ?? null,
      isActive: agent?.isActive ?? true,
    };
  }
  return { approvalStatus: 'APPROVED', approvalReason: null, isActive: true };
}

/**
 * Issues an access JWT including the user's linked dealer (`DealerWiseUser`) and/or agent
 * (`AgentWiseUser`); a user is linked to at most one, so at most one id is non-null.
 *
 * @param userId - User UUID (`sub` claim).
 * @param email - Email for the `email` claim.
 * @param role - Application role.
 * @returns Signed access token string.
 * @throws AppError 403 (4022) when the user's linked firm is paused (`isActive === false`). This is
 *   the single sign-in gate behind login, refresh, passkey login, signup OTP and invitation accept.
 *   Super-admins and users with no firm link are never blocked.
 */
export async function issueUserAccessToken(params: {
  userId: string;
  email: string;
  role: Role;
}): Promise<string> {
  const [dealerId, agentId, user, isDealerOwner] = await Promise.all([
    getPrimaryDealerIdForUser(params.userId),
    getPrimaryAgentIdForUser(params.userId),
    userRepository.findUserById(params.userId),
    isDealerOwnerUser(params.userId),
  ]);
  const { approvalStatus, isActive } = await resolveFirmApproval(dealerId, agentId);
  // Paused firm: no token for any of its login users. Read from the fresh row (not the cache).
  if (!isActive && !user?.isSuperAdmin) {
    throw buildFirmAccessPausedError();
  }
  return signAccessToken({
    sub: params.userId,
    email: params.email,
    role: params.role,
    dealerId,
    agentId,
    isSuperAdmin: user?.isSuperAdmin ?? false,
    // Only meaningful for dealer users; a non-dealer link resolves to false.
    isDealerOwner: dealerId ? isDealerOwner : false,
    approvalStatus,
  });
}
