import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/app-error';
import type { Role } from '../types';

/**
 * Middleware that verifies the Bearer token in the `Authorization` header
 * and attaches the decoded JWT payload to `req.user`.
 *
 * @throws `AppError` with 401 when the token is missing or invalid.
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

  try {
    const payload = verifyToken(token);
    // Only ACCESS tokens authorize normal API use — reject password-reset and refresh tokens.
    if (payload.purpose === 'PASSWORD_RESET' || payload.purpose === 'REFRESH') {
      return next(
        new AppError('Invalid token for this resource', StatusCodes.UNAUTHORIZED, 4015),
      );
    }
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
  } catch {
    next(new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED));
  }
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
