import { z } from 'zod';

const dealerStatusSyncItemSchema = z.object({
  statusId: z.string().uuid('Invalid status ID').optional(),
  statusName: z.string().min(1, 'Status name is required').max(255),
  colour: z.string().min(1, 'Colour is required').max(50),
});

/**
 * POST /dealer-statuses
 * Sync all statuses for a dealer.
 */
export const syncDealerStatusesSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    statusData: z
      .array(dealerStatusSyncItemSchema)
      .min(1, 'At least one status is required'),
  }),
});

/**
 * GET /dealer-statuses/:dealerId
 * Get all statuses for a dealer.
 */
export const getDealerStatusesByDealerIdSchema = z.object({
  params: z.object({
    dealerId: z.string().uuid('Invalid dealer ID'),
  }),
});

export type SyncDealerStatusesBody = z.infer<typeof syncDealerStatusesSchema>['body'];
export type DealerStatusesByDealerIdParams = z.infer<
  typeof getDealerStatusesByDealerIdSchema
>['params'];

/**
 * PUT /dealer-statuses/order
 * Update statusRank for multiple statuses for a dealer.
 */
export const updateDealerStatusOrderSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    items: z
      .array(
        z.object({
          statusId: z.string().uuid('Invalid status ID'),
          statusRank: z.number().int().min(0, 'statusRank must be a non-negative integer'),
        }),
      )
      .min(1, 'At least one status is required')
      .refine(
        (arr) => new Set(arr.map((i) => i.statusId)).size === arr.length,
        'Duplicate statusId not allowed',
      ),
  }),
});

export type UpdateDealerStatusOrderBody = z.infer<
  typeof updateDealerStatusOrderSchema
>['body'];

/**
 * GET /dealer-statuses — current dealer from JWT (no path/query dealerId).
 */
export const listDealerStatusesForSessionSchema = z.object({
  query: z.object({}).optional(),
});
