import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createProcessTask,
  listProcessTasksByProcess,
  getProcessTaskById,
  updateProcessTask,
  deleteProcessTask,
} from '../services/process-task.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreateProcessTaskBody,
  UpdateProcessTaskBody,
  ProcessTaskIdParams,
} from '../validations/process-task.validation';

/**
 * POST /process-tasks
 */
export async function createProcessTaskHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateProcessTaskBody;
  const { dealerId: bodyDealerId, ...rest } = body;
  const dealerId = resolveDealerIdFromRequest(req, bodyDealerId);
  const row = await createProcessTask(dealerId, rest);
  sendSuccess(res, 'Process task created', row, StatusCodes.CREATED);
}

/**
 * GET /process-tasks?processId=
 */
export async function listProcessTasksHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { processId: string; dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  const items = await listProcessTasksByProcess(dealerId, q.processId);
  sendSuccess(res, 'Process tasks retrieved', items);
}

/**
 * GET /process-tasks/:id
 */
export async function getProcessTaskByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessTaskIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
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
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  const row = await updateProcessTask(dealerId, id, body);
  sendSuccess(res, 'Process task updated', row);
}

/**
 * DELETE /process-tasks/:id
 */
export async function deleteProcessTaskHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessTaskIdParams;
  const q = req.query as { dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  await deleteProcessTask(dealerId, id);
  sendSuccess(res, 'Process task deleted', {});
}
