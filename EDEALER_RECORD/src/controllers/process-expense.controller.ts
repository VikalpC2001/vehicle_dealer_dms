import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createProcessExpense,
  listProcessExpensesByProcess,
  getProcessExpenseById,
  updateProcessExpense,
  deleteProcessExpense,
} from '../services/process-expense.service';
import { sendSuccess } from '../utils/api-response';
import { resolveDealerIdFromRequest } from '../utils/dealer-scope';
import type {
  CreateProcessExpenseBody,
  UpdateProcessExpenseBody,
  ProcessExpenseIdParams,
} from '../validations/process-expense.validation';

/**
 * POST /process-expenses — books an expense against a process the caller owns.
 */
export async function createProcessExpenseHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateProcessExpenseBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const expense = await createProcessExpense(dealerId, {
    processId: body.processId,
    label: body.label,
    amount: body.amount,
    category: body.category ?? null,
  });
  sendSuccess(res, 'Expense added', expense, StatusCodes.CREATED);
}

/**
 * GET /process-expenses?processId= — expenses for one process (dealer-scoped).
 */
export async function listProcessExpensesHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { processId: string; dealerId?: string };
  const dealerId = resolveDealerIdFromRequest(req, q.dealerId);
  const items = await listProcessExpensesByProcess(dealerId, q.processId);
  sendSuccess(res, 'Expenses retrieved', items);
}

/**
 * GET /process-expenses/:id — a single expense the caller owns.
 */
export async function getProcessExpenseByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessExpenseIdParams;
  const dealerId = resolveDealerIdFromRequest(req);
  const expense = await getProcessExpenseById(dealerId, id);
  sendSuccess(res, 'Expense retrieved', expense);
}

/**
 * PATCH /process-expenses/:id — updates label / amount / category.
 */
export async function updateProcessExpenseHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessExpenseIdParams;
  const body = req.body as UpdateProcessExpenseBody;
  const dealerId = resolveDealerIdFromRequest(req, body.dealerId);
  const expense = await updateProcessExpense(dealerId, id, {
    label: body.label,
    amount: body.amount,
    category: body.category ?? null,
  });
  sendSuccess(res, 'Expense updated', expense);
}

/**
 * DELETE /process-expenses/:id.
 */
export async function deleteProcessExpenseHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessExpenseIdParams;
  const dealerId = resolveDealerIdFromRequest(req);
  await deleteProcessExpense(dealerId, id);
  sendSuccess(res, 'Expense deleted', {});
}
