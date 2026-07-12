import { z } from 'zod';

const agentStatusSyncItemSchema = z.object({
  statusId: z.string().uuid('Invalid status ID').optional(),
  statusName: z.string().min(1, 'Status name is required').max(255),
  colour: z.string().min(1, 'Colour is required').max(50),
});

/**
 * POST /agent-statuses
 * Sync all statuses for an agent.
 */
export const syncAgentStatusesSchema = z.object({
  body: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
    statusData: z
      .array(agentStatusSyncItemSchema)
      .min(1, 'At least one status is required'),
  }),
});

/**
 * GET /agent-statuses/:agentId
 * Get all statuses for an agent.
 */
export const getAgentStatusesByAgentIdSchema = z.object({
  params: z.object({
    agentId: z.string().uuid('Invalid agent ID'),
  }),
});

export type SyncAgentStatusesBody = z.infer<typeof syncAgentStatusesSchema>['body'];
export type AgentStatusesByAgentIdParams = z.infer<
  typeof getAgentStatusesByAgentIdSchema
>['params'];

/**
 * PUT /agent-statuses/order
 * Update statusRank for multiple statuses for an agent.
 */
export const updateAgentStatusOrderSchema = z.object({
  body: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
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

export type UpdateAgentStatusOrderBody = z.infer<
  typeof updateAgentStatusOrderSchema
>['body'];

/**
 * GET /agent-statuses — current agent from JWT (no path/query agentId).
 */
export const listAgentStatusesForSessionSchema = z.object({
  query: z.object({}).optional(),
});
