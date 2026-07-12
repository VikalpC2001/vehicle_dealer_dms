import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express route handler and forwards any rejected promise to
 * the next error-handling middleware, eliminating the need for try/catch
 * blocks in every controller.
 *
 * @param fn - The async route handler to wrap.
 * @returns A synchronous Express-compatible request handler.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
