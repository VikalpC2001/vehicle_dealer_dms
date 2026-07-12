import type { Request } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Role } from '../types';
import { AppError } from './app-error';

/**
 * Resolves the agent UUID for the current request. Users with role `ADMIN` must pass an explicit
 * `agentId` (path, query, or body). Other roles use the `agentId` claim from the access token;
 * if they pass an explicit value, it must match the token. Mirrors `dealer-scope.ts`.
 *
 * @param explicit - Optional `agentId` from the HTTP request.
 * @returns The agent UUID to use for the operation.
 */
export function resolveAgentIdFromRequest(req: Request, explicit?: string | null): string {
  const client = explicit?.trim() || undefined;

  if (req.user.role === Role.ADMIN) {
    if (!client) {
      throw new AppError(
        'agentId is required in the request for this role',
        StatusCodes.UNPROCESSABLE_ENTITY,
        4226,
      );
    }
    return client;
  }

  const tokenAgentId = req.user.agentId ?? null;
  if (!tokenAgentId) {
    throw new AppError('Your account is not linked to an agent', StatusCodes.FORBIDDEN, 4035);
  }
  if (client && client !== tokenAgentId) {
    throw new AppError('agentId does not match your session', StatusCodes.FORBIDDEN, 4036);
  }
  return tokenAgentId;
}

/**
 * Ensures a resource belongs to the caller's agent (non-admin). Admins bypass this check.
 *
 * @param entityAgentId - `agentId` stored on the resource (may be null in legacy rows).
 */
export function assertAgentMatchesToken(
  req: Request,
  entityAgentId: string | null | undefined,
): void {
  if (req.user.role === Role.ADMIN) {
    return;
  }
  const tokenAgentId = req.user.agentId ?? null;
  if (!tokenAgentId) {
    throw new AppError('Your account is not linked to an agent', StatusCodes.FORBIDDEN, 4035);
  }
  if (!entityAgentId || entityAgentId !== tokenAgentId) {
    throw new AppError('You do not have access to this resource', StatusCodes.FORBIDDEN, 4037);
  }
}
