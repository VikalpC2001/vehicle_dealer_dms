import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { ApiSuccessResponse, ApiErrorResponse, PaginatedResult, PaginationMeta } from '../types';

/**
 * Sends a standardized success JSON response.
 *
 * @param res - The Express response object.
 * @param message - A human-readable success message.
 * @param data - The payload to include in the response body.
 * @param statusCode - The HTTP status code (defaults to 200).
 *
 * @example
 * ```json
 * { "statusCode": 200, "message": "User retrieved", "data": { ... } }
 * ```
 */
export const sendSuccess = <T>(
  res: Response,
  message: string,
  data: T,
  statusCode: number = StatusCodes.OK,
): void => {
  const body: ApiSuccessResponse<T> = { statusCode, message, data };
  res.status(statusCode).json(body);
};

/**
 * Sends a standardized paginated success JSON response.
 *
 * @param res - The Express response object.
 * @param message - A human-readable success message.
 * @param data - The list of items for the current page.
 * @param meta - Pagination metadata (total, page, limit, totalPages).
 */
export const sendPaginated = <T>(
  res: Response,
  message: string,
  data: T[],
  meta: PaginationMeta,
): void => {
  const body: ApiSuccessResponse<PaginatedResult<T>> = {
    statusCode: StatusCodes.OK,
    message,
    data: { data, meta },
  };
  res.status(StatusCodes.OK).json(body);
};

/**
 * Sends a standardized error JSON response.
 *
 * @param res - The Express response object.
 * @param message - A human-readable error message.
 * @param statusCode - The HTTP status code (defaults to 500).
 * @param code - Application-level numeric error code (defaults to 0).
 * @param errors - Optional field-level validation errors.
 *
 * @example
 * ```json
 * { "statusCode": 401, "code": 1001, "message": "User not found" }
 * ```
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
  code: number = 0,
  errors?: Record<string, string[]>,
): void => {
  const body: ApiErrorResponse = { success: false, statusCode, code, message, errors };
  res.status(statusCode).json(body);
};
