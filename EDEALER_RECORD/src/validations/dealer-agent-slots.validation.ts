import { z } from 'zod';

/**
 * PATCH /dealers/:id/agent-slots — super-admin sets (`maxAgents`) or increases (`deltaSlots`) a
 * dealer's active-agent slot limit. Exactly one of the two must be provided.
 */
export const raiseAgentSlotsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid dealer ID') }),
  body: z
    .object({
      maxAgents: z.coerce.number().int().min(0).max(1000).optional(),
      deltaSlots: z.coerce.number().int().min(1).max(1000).optional(),
    })
    .refine((b) => (b.maxAgents != null) !== (b.deltaSlots != null), {
      message: 'Provide exactly one of maxAgents or deltaSlots',
    }),
});

export type RaiseAgentSlotsParams = z.infer<typeof raiseAgentSlotsSchema>['params'];
export type RaiseAgentSlotsBody = z.infer<typeof raiseAgentSlotsSchema>['body'];
