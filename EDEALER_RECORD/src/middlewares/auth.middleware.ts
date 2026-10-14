import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/app-error';
import { buildFirmAccessPausedError, isFirmAccessPaused } from '../services/firm-access.service';
import type { JwtPayload, Role } from '../types';

/**
 * Middleware that verifies the Bearer token in the `Authorization` header
 * and attaches the decoded JWT payload to `req.user`.
 *
 * For a token linked to a dealer/agent firm it also checks — live, not from a JWT claim — that the
 * firm's access is not paused by the super-admin, so a pause takes effect on the user's very next
 * request. That check applies to every guarded route, `/auth` included.
 *
 * @throws `AppError` with 401 when the token is missing or invalid.
 * @throws `AppError` with 403 (4022) when the token's linked firm is paused.
 * @throws `AppError` with 403 (4021) when the linked firm is not approved (non-`/auth` routes).
 */
export const authenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Authentication token is required', StatusCodes.UNAUTHORIZED));
  }

  const token = authHeader.split(' ')[1];

  // Only the JWT verification maps to 401 — the paused lookup below must never be caught here.
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED));
  }

  // Only ACCESS tokens authorize normal API use — reject password-reset and refresh tokens.
  if (payload.purpose === 'PASSWORD_RESET' || payload.purpose === 'REFRESH') {
    return next(new AppError('Invalid token for this resource', StatusCodes.UNAUTHORIZED, 4015));
  }

  /** Runs once the paused check has passed (or was skipped); calls `next` exactly once. */
  const admit = (): void => {
    // Gate self-registered dealers/agents whose firm isn't APPROVED: they may sign in and use the
    // `/auth` routes (e.g. `/auth/me` to poll status, logout) but nothing else until approved.
    // `req.baseUrl` is the router mount (e.g. `/api/v1/vehicle-processes`, `/api/v1/auth`).
    const linkedFirm = payload.dealerId || payload.agentId;
    if (
      linkedFirm &&
      payload.approvalStatus &&
      payload.approvalStatus !== 'APPROVED' &&
      !req.baseUrl.endsWith('/auth')
    ) {
      return next(
        new AppError(
          payload.approvalStatus === 'REJECTED'
            ? 'Your registration was declined'
            : 'Your account is pending approval',
          StatusCodes.FORBIDDEN,
          4021,
        ),
      );
    }
    req.user = payload;
    next();
  };

  // Super-admins and users with no firm link are never paused — stay synchronous for them.
  if (payload.isSuperAdmin || (!payload.dealerId && !payload.agentId)) {
    return admit();
  }

  // Paused firm (super-admin access switch): rejected on EVERY guarded route, `/auth` included.
  // Express 4 does not catch rejected promises, so both outcomes are handled right here: resolve →
  // 4022 or `admit()`; reject → `next(err)`. Fail closed — a failed lookup never admits the
  // request, and it surfaces as a 5xx (a 401 would make the client refresh and sign the user out).
  isFirmAccessPaused(payload.dealerId, payload.agentId).then(
    (paused) => (paused ? next(buildFirmAccessPausedError()) : admit()),
    (err: unknown) =>
      next(err instanceof Error ? err : new AppError('Unable to verify account access')),
  );
};

/**
 * Middleware that accepts only JWTs with `purpose: PASSWORD_RESET` (issued after OTP verification).
 * Used for `POST /auth/reset-password` so reset sessions cannot call normal authenticated routes.
 */
export const authenticatePasswordReset: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Password reset session token is required', StatusCodes.UNAUTHORIZED, 4016));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    if (payload.purpose !== 'PASSWORD_RESET') {
      return next(
        new AppError('Password reset session required', StatusCodes.UNAUTHORIZED, 4016),
      );
    }
    req.user = payload;
    next();
  } catch {
    next(new AppError('Invalid or expired password reset session', StatusCodes.UNAUTHORIZED, 4016));
  }
};

/**
 * Factory that creates a middleware restricting access to specific roles.
 *
 * Must be placed after `authenticate` in the middleware chain.
 *
 * @param roles - One or more roles that are permitted to access the route.
 * @returns An Express `RequestHandler` that enforces role-based access control.
 *
 * @example
 * ```ts
 * router.delete('/users/:id', authenticate, authorize('ADMIN'), deleteUserHandler);
 * ```
 */
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', StatusCodes.FORBIDDEN),
      );
    }
    next();
  };
