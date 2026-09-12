import type { ApprovalStatus } from '@prisma/client';
import type { Role } from '../types';
import { signAccessToken } from '../utils/jwt';
import { getPrimaryDealerIdForUser, isDealerOwnerUser } from './dealer-wise-user.service';
import { getPrimaryAgentIdForUser } from './agent-wise-user.service';
import { findDealerById } from '../repositories/dealer.repository';
import { findAgentById } from '../repositories/agent.repository';
import * as userRepository from '../repositories/user.repository';

/** The linked firm's approval state + reason (defaults APPROVED when there is no firm). */
export interface FirmApproval {
  approvalStatus: ApprovalStatus;
  approvalReason: string | null;
}

/**
 * Resolves the approval state of the user's linked firm (a user has at most one dealer OR agent).
 * A super-admin / unlinked user resolves to APPROVED.
 */
export async function resolveFirmApproval(
  dealerId: string | null,
  agentId: string | null,
): Promise<FirmApproval> {
  if (dealerId) {
    const dealer = await findDealerById(dealerId);
    return { approvalStatus: dealer?.approvalStatus ?? 'APPROVED', approvalReason: dealer?.approvalReason ?? null };
  }
  if (agentId) {
    const agent = await findAgentById(agentId);
    return { approvalStatus: agent?.approvalStatus ?? 'APPROVED', approvalReason: agent?.approvalReason ?? null };
  }
  return { approvalStatus: 'APPROVED', approvalReason: null };
}

/**
 * Issues an access JWT including the user's linked dealer (`DealerWiseUser`) and/or agent
 * (`AgentWiseUser`); a user is linked to at most one, so at most one id is non-null.
 *
 * @param userId - User UUID (`sub` claim).
 * @param email - Email for the `email` claim.
 * @param role - Application role.
 * @returns Signed access token string.
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
  const { approvalStatus } = await resolveFirmApproval(dealerId, agentId);
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
