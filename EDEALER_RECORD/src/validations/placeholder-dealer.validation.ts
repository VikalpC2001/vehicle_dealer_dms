import { z } from 'zod';

/**
 * POST /placeholder-dealers
 * Create a name-only placeholder dealer owned by the calling agent.
 */
export const createPlaceholderSchema = z.object({
  body: z.object({
    firmName: z.string().min(1, 'Firm name is required').max(255),
    dealerName: z.string().min(1, 'Dealer name is required').max(255).optional(),
    displayName: z.string().min(1, 'Display name is required').max(255).optional(),
  }),
});

/**
 * PATCH /placeholder-dealers/:id
 * Update the name fields of a placeholder dealer.
 */
export const updatePlaceholderSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid placeholder dealer ID'),
  }),
  body: z.object({
    firmName: z.string().min(1, 'Firm name is required').max(255).optional(),
    dealerName: z.string().min(1, 'Dealer name is required').max(255).optional(),
    displayName: z.string().min(1, 'Display name is required').max(255).optional(),
  }),
});

/**
 * Params-only schema for routes that act on a single placeholder dealer
 * (DELETE /placeholder-dealers/:id, POST /placeholder-dealers/:id/disconnect).
 */
export const placeholderIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid placeholder dealer ID'),
  }),
});

/**
 * POST /placeholder-dealers/:id/connect
 * Connect a placeholder dealer to a real subscribed dealer.
 */
export const connectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid placeholder dealer ID'),
  }),
  body: z.object({
    realDealerId: z.string().uuid('Invalid dealer ID'),
  }),
});

export type CreatePlaceholderBody = z.infer<typeof createPlaceholderSchema>['body'];
export type UpdatePlaceholderBody = z.infer<typeof updatePlaceholderSchema>['body'];
export type UpdatePlaceholderParams = z.infer<typeof updatePlaceholderSchema>['params'];
export type PlaceholderIdParams = z.infer<typeof placeholderIdParamsSchema>['params'];
export type ConnectParams = z.infer<typeof connectSchema>['params'];
export type ConnectBody = z.infer<typeof connectSchema>['body'];
