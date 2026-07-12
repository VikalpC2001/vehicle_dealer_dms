import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

/**
 * Shapes a `ZodError` into a flat `Record<string, string[]>` suitable for
 * the `errors` field of the API error response envelope.
 *
 * @param error - The Zod validation error object.
 * @returns A map of field paths to their associated error messages.
 */
const formatZodErrors = (error: ZodError): Record<string, string[]> => {
  return error.errors.reduce<Record<string, string[]>>((acc, issue) => {
    const key = issue.path.join('.');
    acc[key] = acc[key] ? [...acc[key], issue.message] : [issue.message];
    return acc;
  }, {});
};

/**
 * Factory that creates an Express middleware which validates the request
 * against the provided Zod schema.
 *
 * The schema should contain a top-level object with optional `body`,
 * `params`, and `query` keys, e.g.:
 *
 * ```ts
 * const schema = z.object({
 *   body: z.object({ email: z.string().email() }),
 *   params: z.object({ id: z.string() }),
 * });
 * ```
 *
 * @param schema - The Zod schema to validate the request against.
 * @returns An Express `RequestHandler` that validates and replaces
 *   `req.body`, `req.params`, and `req.query` with parsed values.
 */
export const validate =
  (schema: ZodSchema): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        success: false,
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: 4220,
        message: 'Validation failed',
        errors: formatZodErrors(result.error),
      });
      return;
    }

    const parsed = result.data as { body?: unknown; params?: unknown; query?: unknown };

    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.params !== undefined) req.params = parsed.params as Record<string, string>;
    if (parsed.query !== undefined) req.query = parsed.query as Record<string, string>;

    next();
  };
