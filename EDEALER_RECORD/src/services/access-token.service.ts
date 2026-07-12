import type { Role } from '../types';
import { signAccessToken } from '../utils/jwt';
import { getPrimaryDealerIdForUser } from './dealer-wise-user.service';
import { getPrimaryAgentIdForUser } from './agent-wise-user.service';
import * as userRepository from '../repositories/user.repository';

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
  const [dealerId, agentId, user] = await Promise.all([
    getPrimaryDealerIdForUser(params.userId),
    getPrimaryAgentIdForUser(params.userId),
    userRepository.findUserById(params.userId),
  ]);
  return signAccessToken({
    sub: params.userId,
    email: params.email,
    role: params.role,
    dealerId,
    agentId,
    isSuperAdmin: user?.isSuperAdmin ?? false,
  });
}
