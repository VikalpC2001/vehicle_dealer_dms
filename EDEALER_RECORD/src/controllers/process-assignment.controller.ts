import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createAssignments,
  listAssignmentsForProcess,
  cancelAssignment,
  updateAssignmentCost,
  listAssignmentsForAgent,
  getAssignmentDetailForAgent,
  loadAssignmentForAgent,
  updateAssignmentAgentStatus,
} from '../services/process-assignment.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import { resolveAgentIdFromRequest, assertAgentMatchesToken } from '../utils/agent-scope';
import { resolveUploadPublicOrigin } from '../utils/request-origin';
import type {
  CreateAssignmentBody,
  ListAssignmentsQuery,
  AssignmentIdParams,
  UpdateAssignmentCostParams,
  UpdateAssignmentCostBody,
  AgentAssignmentsQuery,
  UpdateAgentStatusParams,
  UpdateAgentStatusBody,
} from '../validations/process-assignment.validation';

/**
 * POST /process-assignments
 * Assigns a vehicle process + one or more RTO services to a granted agent (dealer-scoped). One
 * assignment is created per service; already-assigned services are skipped.
 */
export async function createAssignmentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateAssignmentBody;
  const dealerId = resolveDealerIdFromRequest(req);
  const result = await createAssignments(dealerId, {
    processId: body.processId,
    agentId: body.agentId,
    serviceIds: body.serviceIds,
    note: body.note ?? null,
    assignedByUserId: req.user.sub,
    cost: body.cost ?? null,
    costDate: body.costDate ?? null,
    costNote: body.costNote ?? null,
  });
  sendSuccess(res, 'Process assignment created', result, StatusCodes.CREATED);
}

/**
 * PATCH /process-assignments/:id/cost
 * Sets/changes/removes the agent cost recorded in the ledger for an assignment (dealer-scoped).
 */
export async function updateAssignmentCostHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as UpdateAssignmentCostParams;
  const body = req.body as UpdateAssignmentCostBody;
  const dealerId = resolveDealerIdFromRequest(req);
  const cost = await updateAssignmentCost(dealerId, id, {
    cost: body.cost,
    costDate: body.costDate,
    costNote: body.costNote,
    userId: req.user.sub,
  });
  sendSuccess(res, 'Assignment cost updated', cost);
}

/**
 * GET /process-assignments?processId=
 * Lists the non-cancelled assignments for a vehicle process (dealer-scoped).
 */
export async function listAssignmentsHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListAssignmentsQuery;
  const dealerId = resolveDealerIdFromRequest(req);
  const assignments = await listAssignmentsForProcess(dealerId, query.processId);
  sendSuccess(res, 'Process assignments retrieved', assignments);
}

/**
 * DELETE /process-assignments/:id
 * Cancels a single assignment owned by the caller's dealer (dealer-scoped).
 */
export async function cancelAssignmentHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as AssignmentIdParams;
  const dealerId = resolveDealerIdFromRequest(req);
  const assignment = await cancelAssignment(dealerId, id);
  sendSuccess(res, 'Process assignment cancelled', assignment);
}

/**
 * GET /process-assignments/agent?dealerId=
 * Lists the caller agent's non-cancelled assignments, optionally filtered to one source dealer.
 */
export async function listAgentAssignmentsHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as AgentAssignmentsQuery;
  const agentId = resolveAgentIdFromRequest(req);
  const assignments = await listAssignmentsForAgent(agentId, query.dealerId);
  sendSuccess(res, 'Agent assignments retrieved', assignments);
}

/**
 * GET /process-assignments/:id/details
 * Returns the assignment, the full vehicle-process detail, and the source dealer summary
 * (agent-scoped — the assignment must belong to the caller agent).
 */
export async function getAssignmentDetailsHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as AssignmentIdParams;
  const publicOrigin = resolveUploadPublicOrigin(req);
  const detail = await getAssignmentDetailForAgent(id, publicOrigin);
  assertAgentMatchesToken(req, detail.assignment.agentId);
  sendSuccess(res, 'Assignment details retrieved', detail);
}

/**
 * PATCH /process-assignments/:id/agent-status
 * Moves the caller agent's assignment into one of the agent's own kanban statuses.
 */
export async function updateAgentStatusHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as UpdateAgentStatusParams;
  const body = req.body as UpdateAgentStatusBody;
  const existing = await loadAssignmentForAgent(id);
  assertAgentMatchesToken(req, existing.agentId);
  const agentId = resolveAgentIdFromRequest(req);
  const assignment = await updateAssignmentAgentStatus(agentId, id, body.agentStatusId);
  sendSuccess(res, 'Assignment status updated', assignment);
}
