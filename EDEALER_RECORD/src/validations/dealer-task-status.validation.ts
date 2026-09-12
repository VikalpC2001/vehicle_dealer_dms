import { z } from 'zod';

const dealerTaskStatusSyncItemSchema = z.object({
  statusId: z.string().uuid('Invalid status ID').optional(),
  statusName: z.string().min(1, 'Status name is required').max(255),
  colour: z.string().min(1, 'Colour is required').max(50),
  isDone: z.boolean().optional(),
});

/**
 * POST /dealer-task-statuses
 * Sync all task statuses for a dealer.
 */
export const syncDealerTaskStatusesSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    statusData: z
      .array(dealerTaskStatusSyncItemSchema)
      .min(1, 'At least one status is required'),
  }),
});

/**
 * GET /dealer-task-statuses/:dealerId
 * Get all task statuses for a dealer.
 */
export const getDealerTaskStatusesByDealerIdSchema = z.object({
  params: z.object({
    dealerId: z.string().uuid('Invalid dealer ID'),
  }),
});

export type SyncDealerTaskStatusesBody = z.infer<
  typeof syncDealerTaskStatusesSchema
>['body'];
export type DealerTaskStatusesByDealerIdParams = z.infer<
  typeof getDealerTaskStatusesByDealerIdSchema
>['params'];

/**
 * PUT /dealer-task-statuses/order
 * Update statusRank for multiple task statuses for a dealer.
 */
export const updateDealerTaskStatusOrderSchema = z.object({
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

export type UpdateDealerTaskStatusOrderBody = z.infer<
  typeof updateDealerTaskStatusOrderSchema
>['body'];

/**
 * GET /dealer-task-statuses — current dealer from JWT (no path/query dealerId).
 */
export const listDealerTaskStatusesForSessionSchema = z.object({
  query: z.object({}).optional(),
});
