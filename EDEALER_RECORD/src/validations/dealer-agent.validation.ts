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

/**
 * GET /dealer-agents/search?q=
 * Search agents the calling dealer could grant (min 2 chars).
 */
export const searchDealerAgentsSchema = z.object({
  query: z.object({
    q: z.string().trim().min(2, 'Enter at least 2 characters to search'),
  }),
});

export type CreateDealerAgentBody = z.infer<typeof createDealerAgentSchema>['body'];
export type DealerAgentIdParams = z.infer<typeof dealerAgentIdParamsSchema>['params'];
export type SearchDealerAgentsQuery = z.infer<typeof searchDealerAgentsSchema>['query'];
