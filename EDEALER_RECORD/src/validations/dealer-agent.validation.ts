import { z } from 'zod';

/**
 * POST /dealer-agents
 * Grant agent-site access to an agent for the calling dealer.
 */
export const createDealerAgentSchema = z.object({
  body: z.object({
    agentId: z.string().uuid('Invalid agent ID'),
  }),
});

/**
 * DELETE /dealer-agents/:id
 * Revoke a dealer-agent grant by its dealerAgentId.
 */
export const dealerAgentIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer-agent ID'),
  }),
});

export type CreateDealerAgentBody = z.infer<typeof createDealerAgentSchema>['body'];
export type DealerAgentIdParams = z.infer<typeof dealerAgentIdParamsSchema>['params'];
