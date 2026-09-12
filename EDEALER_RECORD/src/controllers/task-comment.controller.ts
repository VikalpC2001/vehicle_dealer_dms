import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { CommentAuthorRole } from '@prisma/client';
import { getProcessTaskById } from '../services/process-task.service';
import {
  listTaskComments,
  createTaskComment,
  getTaskCommentOnTask,
  updateTaskComment,
  deleteTaskComment,
} from '../services/task-comment.service';
import { resolveManagedDealerId } from '../utils/managed-dealer-scope';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import type {
  TaskCommentParams,
  TaskCommentIdParams,
  CreateTaskCommentBody,
  UpdateTaskCommentBody,
} from '../validations/task-comment.validation';

/** Derives the comment author persona from the authenticated token. */
function resolveAuthorRole(req: Request): CommentAuthorRole {
  if (req.user.isSuperAdmin) return 'ADMIN';
  if (req.user.dealerId) return 'DEALER';
  return 'AGENT';
}

/**
 * Resolves the dealer scope and asserts the caller may access the task (its process belongs to that
 * dealer). This lets the dealer's team (owner + employees) and a managing agent read/post to the
 * thread. `getProcessTaskById` throws 4057 (task not found) or 4034 (wrong dealer).
 *
 * @param req - The authenticated request (optional `dealerId` in the query for managing-agent scope).
 * @param taskId - The task the thread is anchored on.
 */
async function assertCanAccessTask(req: Request, taskId: string): Promise<void> {
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  await getProcessTaskById(dealerId, taskId);
}

/**
 * GET /process-tasks/:id/comments — the shared comment thread for a task. Authorized for the dealer
 * team (owner + employees), the managing agent, and super-admin.
 */
export async function listTaskCommentsHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as TaskCommentParams;
  await assertCanAccessTask(req, id);
  const data = await listTaskComments(id);
  sendSuccess(res, 'Task comments retrieved', data);
}

/**
 * POST /process-tasks/:id/comments — post a comment to a task's shared thread.
 */
export async function createTaskCommentHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as TaskCommentParams;
  const { body } = req.body as CreateTaskCommentBody;
  await assertCanAccessTask(req, id);
  const comment = await createTaskComment(id, {
    authorUserId: req.user.sub,
    authorRole: resolveAuthorRole(req),
    body,
  });
  sendSuccess(res, 'Comment added', comment, StatusCodes.CREATED);
}

/**
 * PATCH /process-tasks/:id/comments/:commentId — edit a comment. Only the author may edit their own
 * comment (editing another's content would misrepresent authorship).
 */
export async function updateTaskCommentHandler(req: Request, res: Response): Promise<void> {
  const { id, commentId } = req.params as unknown as TaskCommentIdParams;
  const { body } = req.body as UpdateTaskCommentBody;
  await assertCanAccessTask(req, id);
  const comment = await getTaskCommentOnTask(id, commentId);
  if (comment.authorUserId !== req.user.sub) {
    throw new AppError('You can only edit your own comment', StatusCodes.FORBIDDEN, 4062);
  }
  const updated = await updateTaskComment(commentId, body);
  sendSuccess(res, 'Comment updated', updated);
}

/**
 * DELETE /process-tasks/:id/comments/:commentId — delete a comment. The author may delete their
 * own; a super-admin may delete any (moderation).
 */
export async function deleteTaskCommentHandler(req: Request, res: Response): Promise<void> {
  const { id, commentId } = req.params as unknown as TaskCommentIdParams;
  await assertCanAccessTask(req, id);
  const comment = await getTaskCommentOnTask(id, commentId);
  const isAuthor = comment.authorUserId === req.user.sub;
  if (!isAuthor && !req.user.isSuperAdmin) {
    throw new AppError('You can only delete your own comment', StatusCodes.FORBIDDEN, 4062);
  }
  await deleteTaskComment(commentId);
  sendSuccess(res, 'Comment deleted', {});
}
