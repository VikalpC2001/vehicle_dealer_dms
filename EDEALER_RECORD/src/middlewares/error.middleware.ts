import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { config } from '../config';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';

/**
 * Maps Prisma-specific errors to HTTP-friendly `AppError` instances so that
 * database errors are surfaced consistently without leaking internal details.
 *
 * @param err - The Prisma error to handle.
 * @returns An `AppError` with an appropriate status code and message.
 */
const handlePrismaError = (err: PrismaClientKnownRequestError): AppError => {
  switch (err.code) {
    case 'P2002':
      return new AppError('A record with this value already exists', StatusCodes.CONFLICT, 4090);
    case 'P2025':
      return new AppError('The requested record was not found', StatusCodes.NOT_FOUND, 4040);
    case 'P2003':
      return new AppError('Related record not found', StatusCodes.BAD_REQUEST, 4000);
    default:
      logger.error(`Prisma error [${err.code}]: ${err.message}`, { meta: err.meta });
      const message =
        config.NODE_ENV === 'development'
          ? `Database error: ${err.message} (code: ${err.code})`
          : 'A database error occurred';
      return new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR, 5000);
  }
};

/**
 * Global Express error-handling middleware.
 *
 * Catches all errors forwarded via `next(err)` and returns a standardized
 * JSON error response. Prisma errors are normalized automatically.
 *
 * Must be registered **last** in the Express middleware chain.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  let error = err instanceof AppError ? err : new AppError(err.message);

  if (err instanceof PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  }

  if (err instanceof PrismaClientValidationError) {
    const message =
      config.NODE_ENV === 'development'
        ? `${err.message} If you edited prisma/schema.prisma, run \`npx prisma generate\` and save a file (or restart the dev server).`
        : 'Invalid data provided';
    error = new AppError(message, StatusCodes.BAD_REQUEST, 4001);
  }

  res.status(error.statusCode).json({
    success: false,
    statusCode: error.statusCode,
    code: error.code,
    message: error.message,
    ...(config.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

/**
 * Middleware that returns a 404 response for any route that is not matched.
 *
 * Register this **before** `errorHandler` and after all route definitions.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, StatusCodes.NOT_FOUND));
};
