import type { Request } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Role } from '../types';
import { AppError } from './app-error';

/**
 * Resolves the dealer UUID for the current request. Users with role `ADMIN` must pass an explicit
 * `dealerId` (path, query, or body). Other roles use the `dealerId` claim from the access token;
 * if they pass an explicit value, it must match the token.
 *
 * @param explicit - Optional `dealerId` from the HTTP request.
 * @returns The dealer UUID to use for the operation.
 */
export function resolveDealerIdFromRequest(req: Request, explicit?: string | null): string {
  const client = explicit?.trim() || undefined;

  if (req.user.role === Role.ADMIN) {
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
  if (!tokenDealerId) {
    throw new AppError(
      'Your account is not linked to a dealer',
      StatusCodes.FORBIDDEN,
      4033,
    );
  }
  if (client && client !== tokenDealerId) {
    throw new AppError(
      'dealerId does not match your session',
      StatusCodes.FORBIDDEN,
      4032,
    );
  }
  return tokenDealerId;
}

/**
 * Ensures a resource belongs to the caller's dealer (non-admin). Admins bypass this check.
 *
 * @param entityDealerId - `dealerId` stored on the resource (may be null in legacy rows).
 */
export function assertDealerMatchesToken(
  req: Request,
  entityDealerId: string | null | undefined,
): void {
  if (req.user.role === Role.ADMIN) {
    return;
  }
  const tokenDealerId = req.user.dealerId ?? null;
  if (!tokenDealerId) {
    throw new AppError(
      'Your account is not linked to a dealer',
      StatusCodes.FORBIDDEN,
      4033,
    );
  }
  if (!entityDealerId || entityDealerId !== tokenDealerId) {
    throw new AppError('You do not have access to this resource', StatusCodes.FORBIDDEN, 4034);
  }
}

/**
 * Data-isolation for the `/dealers` resource. The privilege signal is the JWT
 * `isSuperAdmin` flag (`User.isSuperAdmin`) — there is no ADMIN role (every token is
 * `USER`). Super-admins pass; a dealer is scoped to their own dealer; everyone else
 * (agents, unlinked signups) is denied.
 */

/** Ensures the caller may act on `dealerId`: super-admin (any) or a dealer on their OWN dealer. */
export function assertOwnDealer(req: Request, dealerId: string): void {
  if (req.user.isSuperAdmin) return;
  if (req.user.dealerId && req.user.dealerId === dealerId) return;
  throw new AppError('You do not have access to this dealer', StatusCodes.FORBIDDEN, 4034);
}

/** Restricts an action to the platform super-admin (`isSuperAdmin` in the token). */
export function assertSuperAdmin(req: Request): void {
  if (!req.user.isSuperAdmin) {
    throw new AppError('Only the platform admin can perform this action', StatusCodes.FORBIDDEN, 4038);
  }
}
