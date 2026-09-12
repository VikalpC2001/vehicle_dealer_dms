import type { Request, RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from './app-error';
import { asyncHandler } from './async-handler';
import { ALL_CAPABILITY_KEYS, READONLY_DEFAULT_CAPABILITIES } from '../config/dealer-capabilities';
import { findDealerWiseUserAuthByUserId } from '../repositories/dealer-wise-user.repository';

/** The effective capability set resolved for a request's caller. */
export interface ResolvedDealerCapabilities {
  /** True for the dealership owner and the platform super-admin (implicitly full access). */
  isOwner: boolean;
  /** Effective capability keys the caller currently holds. */
  capabilities: string[];
}

/**
 * Resolves the caller's effective dealer capabilities FRESH from the DB (never from the token), so
 * a role change takes effect without re-login. Precedence:
 *
 * - super-admin (`isSuperAdmin`) => owner + ALL capabilities.
 * - dealer OWNER (`DealerWiseUser.isOwner`) => owner + ALL capabilities.
 * - dealer employee WITH a `roleId` => that role's `capabilities`.
 * - dealer employee WITHOUT a role => {@link READONLY_DEFAULT_CAPABILITIES}.
 * - anyone else (agent / unlinked) => no dealer capabilities.
 *
 * @param req - The authenticated request (`req.user` set by `authenticate`).
 */
export async function resolveDealerCapabilities(
  req: Request,
): Promise<ResolvedDealerCapabilities> {
  if (req.user.isSuperAdmin) {
    return { isOwner: true, capabilities: [...ALL_CAPABILITY_KEYS] };
  }

  const auth = await findDealerWiseUserAuthByUserId(req.user.sub);
  if (!auth) {
    return { isOwner: false, capabilities: [] };
  }
  if (auth.isOwner) {
    return { isOwner: true, capabilities: [...ALL_CAPABILITY_KEYS] };
  }
  if (auth.roleId && auth.role) {
    return { isOwner: false, capabilities: [...auth.role.capabilities] };
  }
  return { isOwner: false, capabilities: [...READONLY_DEFAULT_CAPABILITIES] };
}

/**
 * Middleware factory that gates a route on a single capability. Owners and super-admins pass (they
 * hold every capability). Resolves per-request via {@link resolveDealerCapabilities}.
 *
 * @param cap - The capability key required to proceed.
 * @throws AppError 4067 (403) when the resolved set lacks `cap`.
 */
export function requireCapability(cap: string): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const { capabilities } = await resolveDealerCapabilities(req);
    if (!capabilities.includes(cap)) {
      throw new AppError(
        'You do not have permission to perform this action',
        StatusCodes.FORBIDDEN,
        4067,
      );
    }
    next();
  });
}
