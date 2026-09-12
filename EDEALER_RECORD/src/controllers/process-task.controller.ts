import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createProcessTask,
  listProcessTasksByProcess,
  listProcessTaskBoard,
  listProcessTaskHistory,
  getProcessTaskById,
  updateProcessTask,
  deleteProcessTask,
} from '../services/process-task.service';
import { sendSuccess, sendPaginated } from '../utils/api-response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { resolveManagedDealerId } from '../utils/managed-dealer-scope';
import { resolveDealerCapabilities } from '../utils/dealer-capabilities';
import type {
  CreateProcessTaskBody,
  UpdateProcessTaskBody,
  ProcessTaskIdParams,
  ListProcessTaskBoardQuery,
  ListProcessTaskHistoryQuery,
} from '../validations/process-task.validation';

/**
 * POST /process-tasks
 */
export async function createProcessTaskHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateProcessTaskBody;
  const { dealerId: bodyDealerId, ...rest } = body;
  const dealerId = await resolveManagedDealerId(req, bodyDealerId, { gateSubscription: false });
  const row = await createProcessTask(dealerId, rest);
  sendSuccess(res, 'Process task created', row, StatusCodes.CREATED);
}

/**
 * GET /process-tasks?processId=
 */
export async function listProcessTasksHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { processId: string; dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const items = await listProcessTasksByProcess(dealerId, q.processId);
  sendSuccess(res, 'Process tasks retrieved', items);
}

/**
 * GET /process-tasks/board
 */
export async function listProcessTaskBoardHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as ListProcessTaskBoardQuery;
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  // A dealer EMPLOYEE (non-owner dealer user) without `tasks.viewAll` is restricted to their OWN
  // tasks regardless of the client-sent `mine`. Owner, agents, and super-admin are unaffected
  // (they either bypass or resolve to all capabilities).
  let mine = q.mine;
  if (req.user.dealerId && !req.user.isDealerOwner) {
    const { capabilities } = await resolveDealerCapabilities(req);
    if (!capabilities.includes('tasks.viewAll')) {
      mine = true;
    }
  }
  const items = await listProcessTaskBoard(
    dealerId,
    { status: q.status, assignUserId: q.assignUserId, mine },
    req.user.sub,
  );
  sendSuccess(res, 'Process task board retrieved', items);
}

/**
 * GET /process-tasks/history
 * Dealer-scoped, all-time list of COMPLETED tasks (paginated, newest completion first).
 */
export async function listProcessTaskHistoryHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as ListProcessTaskHistoryQuery;
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  // Same employee-scoping as the board: a non-owner dealer user lacking `tasks.viewAll` only sees
  // their OWN completed tasks, regardless of the client-sent `mine`.
  let mine = q.mine;
  if (req.user.dealerId && !req.user.isDealerOwner) {
    const { capabilities } = await resolveDealerCapabilities(req);
    if (!capabilities.includes('tasks.viewAll')) {
      mine = true;
    }
  }
  const { skip, take } = parsePagination(req.query);
  const { items, total } = await listProcessTaskHistory(
    dealerId,
    { assignUserId: q.assignUserId, mine },
    req.user.sub,
    skip,
    take,
  );
  sendPaginated(res, 'Process task history retrieved', items, buildPaginationMeta(total, req.query));
}

/**
 * GET /process-tasks/:id
 */
export async function getProcessTaskByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessTaskIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const row = await getProcessTaskById(dealerId, id);
  sendSuccess(res, 'Process task retrieved', row);
}

/**
 * PATCH /process-tasks/:id
 */
export async function updateProcessTaskHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessTaskIdParams;
  const body = req.body as UpdateProcessTaskBody;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const row = await updateProcessTask(dealerId, id, body);
  sendSuccess(res, 'Process task updated', row);
}

/**
 * DELETE /process-tasks/:id
 */
export async function deleteProcessTaskHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessTaskIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  await deleteProcessTask(dealerId, id);
  sendSuccess(res, 'Process task deleted', {});
}
