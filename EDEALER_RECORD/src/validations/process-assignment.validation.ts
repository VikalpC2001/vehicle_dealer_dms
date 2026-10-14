import { z } from 'zod';

/**
 * Money amount for an agent cost: positive, at most 2 decimals, within Decimal(14,2). Mirrors the
 * khata `amountField` so an assignment cost validates identically to a manual ledger entry.
 */
const costAmountField = z.coerce
  .number()
  .positive('Amount must be greater than zero')
  .max(999_999_999_999.99, 'Amount is too large')
  .refine(
    (v) => Number.isFinite(v) && /^\d+(\.\d{1,2})?$/.test(v.toString()),
    'At most 2 decimal places',
  );

/**
 * POST /process-assignments
 * Assigns a vehicle process + one or more chosen RTO services to an agent the dealer has granted
 * access to — one assignment row is created per service. An optional `cost` records money the dealer
 * owes the agent for the job in the khata ledger (posted atomically), applied **per service**;
 * `costDate` sets the ledger entry's book date, `costNote` its description. Services already actively
 * assigned to that agent for the process are skipped.
 */
export const createAssignmentSchema = z.object({
  body: z.object({
    processId: z.string().uuid('Invalid process ID'),
    agentId: z.string().uuid('Invalid agent ID'),
    serviceIds: z
      .array(z.string().uuid('Invalid service ID'))
      .min(1, 'Select at least one service')
      .max(50, 'Too many services'),
    note: z.string().max(2000, 'Note is too long').optional(),
    cost: costAmountField.optional(),
    costDate: z.coerce.date().optional(),
    costNote: z.string().max(2000, 'Note is too long').optional(),
  }),
});

/**
 * PATCH /process-assignments/:id/cost
 * Sets/changes/removes the agent cost recorded in the ledger for an assignment.
 * `cost`: a positive number to set the amount, `null` to remove the cost, omitted to keep it
 * (edit only the date/note). Editing the amount posts a ledger reversal + new entry; editing only
 * the date/note updates the entry in place.
 */
export const updateAssignmentCostSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid assignment ID'),
  }),
  body: z.object({
    cost: costAmountField.nullable().optional(),
    costDate: z.coerce.date().optional(),
    costNote: z.string().max(2000, 'Note is too long').optional(),
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
 * GET /process-assignments/by-agent/:agentId
 * Dealer-scoped, paginated list of the work the caller's dealer has assigned to one agent.
 * `search` matches the vehicle registration number / make / model and the service name;
 * `agentStatusId` narrows to one of the agent's kanban statuses, or `none` for no status yet.
 */
export const dealerAgentAssignmentsSchema = z.object({
  params: z.object({
    agentId: z.string().uuid('Invalid agent ID'),
  }),
  query: z.object({
    // Whole numbers only (a fraction or an out-of-range page would otherwise reach Prisma).
    // `limit` above 100 is accepted and capped by `parsePagination`.
    page: z.coerce.number().int().positive().max(1_000_000).optional(),
    limit: z.coerce.number().int().positive().optional(),
    search: z
      .string()
      .trim()
      .max(100, 'Search is too long')
      // Postgres text cannot hold a NUL byte.
      .refine((value) => !value.includes('\u0000'), 'Invalid search')
      .optional(),
    agentStatusId: z
      .union([z.string().uuid('Invalid agent status ID'), z.literal('none')])
      .optional(),
  }),
});

/**
 * GET /process-assignments/by-agent/:agentId/summary
 * Dealer-scoped totals for the work the caller's dealer has assigned to one agent.
 */
export const dealerAgentAssignmentSummarySchema = z.object({
  params: z.object({
    agentId: z.string().uuid('Invalid agent ID'),
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
export type UpdateAssignmentCostParams = z.infer<typeof updateAssignmentCostSchema>['params'];
export type UpdateAssignmentCostBody = z.infer<typeof updateAssignmentCostSchema>['body'];
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>['query'];
export type AssignmentIdParams = z.infer<typeof assignmentIdParamsSchema>['params'];
export type AgentAssignmentsQuery = z.infer<typeof agentAssignmentsQuerySchema>['query'];
export type UpdateAgentStatusParams = z.infer<typeof updateAgentStatusSchema>['params'];
export type UpdateAgentStatusBody = z.infer<typeof updateAgentStatusSchema>['body'];
export type DealerAgentAssignmentsParams = z.infer<typeof dealerAgentAssignmentsSchema>['params'];
export type DealerAgentAssignmentsQuery = z.infer<typeof dealerAgentAssignmentsSchema>['query'];
