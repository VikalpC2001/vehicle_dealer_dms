import { StatusCodes } from 'http-status-codes';

/**
 * Custom application error that carries an HTTP status code and an
 * application-level error code.
 *
 * Throw this class inside services or repositories to propagate
 * operational errors through to the global error-handling middleware.
 *
 * @example
 * ```ts
 * throw new AppError('User not found', StatusCodes.NOT_FOUND, 1001);
 * ```
 */
export class AppError extends Error {
  /** HTTP status code associated with this error. */
  public readonly statusCode: number;

  /** Application-level error code for programmatic error identification. */
  public readonly code: number;

  /** Whether the error is operational (expected) vs a programming error. */
  public readonly isOperational: boolean;

  /**
   * @param message - Human-readable error description.
   * @param statusCode - HTTP status code to respond with.
   * @param code - Application-level numeric error code.
   * @param isOperational - Set to `false` for unexpected programming errors.
   */
  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: number = 0,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
