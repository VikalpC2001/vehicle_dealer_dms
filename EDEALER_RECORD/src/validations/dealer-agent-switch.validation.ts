import { z } from 'zod';

/**
 * GET /dealer-agents/switch-preview?oldAgentId=
 * Preview a dealer's open work + ledger balance with an agent before switching.
 */
export const switchPreviewSchema = z.object({
  query: z.object({
    oldAgentId: z.string().uuid('Invalid agent ID'),
  }),
});

/**
 * POST /dealer-agents/switch
 * Switch off an agent (optionally onto a replacement), settling or keeping the ledger.
 */
export const switchAgentSchema = z.object({
  body: z.object({
    oldAgentId: z.string().uuid('Invalid agent ID'),
    newAgentId: z.string().uuid('Invalid replacement agent ID').optional(),
    settleDecision: z.enum(['SETTLE', 'KEEP']),
    settleAmount: z.coerce.number().positive('Amount must be greater than 0').optional(),
  }),
});

export type SwitchPreviewQuery = z.infer<typeof switchPreviewSchema>['query'];
export type SwitchAgentBody = z.infer<typeof switchAgentSchema>['body'];
