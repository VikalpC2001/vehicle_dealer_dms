import type { PaginationMeta, PaginationQuery } from '../types';

/** Default number of items returned per page. */
const DEFAULT_LIMIT = 10;

/** Maximum number of items that can be requested per page. */
const MAX_LIMIT = 100;

/**
 * Normalises raw pagination query params into safe, bounded values.
 *
 * @param query - Raw pagination query parameters from the request.
 * @returns An object containing `skip` and `take` values for Prisma.
 */
export const parsePagination = (query: PaginationQuery): { skip: number; take: number } => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  return { skip: (page - 1) * limit, take: limit };
};

/**
 * Builds the pagination metadata object for a paginated response.
 *
 * @param total - The total number of records matching the query.
 * @param query - The pagination query parameters from the request.
 * @returns A `PaginationMeta` object to include in the response envelope.
 */
export const buildPaginationMeta = (total: number, query: PaginationQuery): PaginationMeta => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
