import { z } from 'zod';

/**
 * POST /process-assignments
 * Assigns a vehicle process + chosen RTO service to an agent the dealer has granted access to.
 */
export const createAssignmentSchema = z.object({
  body: z.object({
    processId: z.string().uuid('Invalid process ID'),
    agentId: z.string().uuid('Invalid agent ID'),
    serviceId: z.string().uuid('Invalid service ID'),
    note: z.string().max(2000, 'Note is too long').optional(),
  }),
});

/**
 * GET /process-assignments?processId=
 * Lists the non-cancelled assignments for a single vehicle process.
 */
export const listAssignmentsQuerySchema = z.object({
  query: z.object({
    processId: z.string().uuid('Invalid process ID'),
  }),
});

/**
 * DELETE /process-assignments/:id  ·  GET /process-assignments/:id/details
 * Identifies a single assignment by its UUID path param.
 */
export const assignmentIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid assignment ID'),
  }),
});

/**
 * GET /process-assignments/agent?dealerId=
 * Lists the agent's non-cancelled assignments, optionally filtered to one source dealer.
 */
export const agentAssignmentsQuerySchema = z.object({
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

/**
 * PATCH /process-assignments/:id/agent-status
 * Moves an assignment into one of the agent's own kanban statuses.
 */
export const updateAgentStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid assignment ID'),
  }),
  body: z.object({
    agentStatusId: z.string().uuid('Invalid agent status ID'),
  }),
});

export type CreateAssignmentBody = z.infer<typeof createAssignmentSchema>['body'];
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>['query'];
export type AssignmentIdParams = z.infer<typeof assignmentIdParamsSchema>['params'];
export type AgentAssignmentsQuery = z.infer<typeof agentAssignmentsQuerySchema>['query'];
export type UpdateAgentStatusParams = z.infer<typeof updateAgentStatusSchema>['params'];
export type UpdateAgentStatusBody = z.infer<typeof updateAgentStatusSchema>['body'];
