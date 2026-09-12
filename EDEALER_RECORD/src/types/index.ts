/**
 * Application roles.
 *
 * Extend this enum to match the roles defined in your Prisma schema.
 */
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

/** Authenticated user payload decoded from the JWT. */
export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: Role;
  /**
   * Dealer linked via `DealerWiseUser` (access tokens). Omitted or `null` if not assigned.
   * Password-reset tokens do not include this claim.
   */
  readonly dealerId?: string | null;
  /**
   * Agent linked via `AgentWiseUser` (access tokens). Omitted or `null` if not assigned.
   * A user is linked to at most one of a dealer or an agent, so at most one of
   * `dealerId`/`agentId` is non-null.
   */
  readonly agentId?: string | null;
  /**
   * Platform super-admin flag (`User.isSuperAdmin`). The only privilege signal — every
   * token's `role` is `USER`. A super-admin has neither a `dealerId` nor an `agentId`.
   */
  readonly isSuperAdmin?: boolean;
  /**
   * Whether the user's `DealerWiseUser` link is the dealership OWNER (full access, manages roles).
   * Only meaningful for dealer users; `false`/absent for agents, unlinked signups, and super-admins.
   * A convenience hint for the FE — the authoritative check is the fresh capability resolver.
   */
  readonly isDealerOwner?: boolean;
  /**
   * Self-registration approval state of the linked dealer/agent firm. Absent/`APPROVED` = full
   * access; `PENDING`/`REJECTED` self-registrations are blocked from non-auth routes until approved.
   */
  readonly approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** `ACCESS` for normal API use; `PASSWORD_RESET` only for POST /auth/reset-password; `REFRESH` only for POST /auth/refresh. */
  readonly purpose?: 'ACCESS' | 'PASSWORD_RESET' | 'REFRESH';
  readonly iat?: number;
  readonly exp?: number;
}

/**
 * Augments the Express `Request` interface to carry the authenticated user.
 *
 * The `user` field is set by the `authenticate` middleware and is available
 * on any route that runs after it.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: JwtPayload;
    }
  }
}

/** Generic paginated response envelope. */
export interface PaginatedResult<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;
}

/** Pagination metadata included in list responses. */
export interface PaginationMeta {
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

/** Query parameters used for paginated list endpoints. */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

/**
 * Standard API error shape returned to clients.
 *
 * @example
 * ```json
 * { "statusCode": 401, "code": 1001, "message": "User not found" }
 * ```
 */
export interface ApiErrorResponse {
  readonly success?: false;
  readonly statusCode: number;
  readonly code: number;
  readonly message: string;
  readonly errors?: Record<string, string[]>;
}

/**
 * Standard API success shape returned to clients.
 *
 * @example
 * ```json
 * { "statusCode": 200, "message": "OK", "data": { ... } }
 * ```
 */
export interface ApiSuccessResponse<T> {
  readonly statusCode: number;
  readonly message: string;
  readonly data: T;
}
