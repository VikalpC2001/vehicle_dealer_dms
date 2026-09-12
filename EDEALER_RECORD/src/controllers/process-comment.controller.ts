import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { CommentAuthorRole } from '@prisma/client';
import { getVehicleProcessById } from '../services/vehicle-process.service';
import {
  listProcessComments,
  createProcessComment,
  getProcessCommentOnProcess,
  updateProcessComment,
  deleteProcessComment,
} from '../services/process-comment.service';
import { assertCanAccessProcess } from '../utils/managed-dealer-scope';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import type {
  ProcessCommentParams,
  ProcessCommentIdParams,
  CreateProcessCommentBody,
  UpdateProcessCommentBody,
} from '../validations/process-comment.validation';

/** Derives the comment author persona from the authenticated token. */
function resolveAuthorRole(req: Request): CommentAuthorRole {
  if (req.user.isSuperAdmin) return 'ADMIN';
  if (req.user.dealerId) return 'DEALER';
  return 'AGENT';
}

/**
 * GET /vehicle-processes/:id/comments — the shared comment thread for a process. Authorized for the
 * dealer owner, the managing/assigned agent, and super-admin.
 */
export async function listProcessCommentsHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessCommentParams;
  const process = await getVehicleProcessById(id);
  await assertCanAccessProcess(req, process);
  const data = await listProcessComments(id);
  sendSuccess(res, 'Process comments retrieved', data);
}

/**
 * POST /vehicle-processes/:id/comments — post a comment to a process's shared thread.
 */
export async function createProcessCommentHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as ProcessCommentParams;
  const { body } = req.body as CreateProcessCommentBody;
  const process = await getVehicleProcessById(id);
  await assertCanAccessProcess(req, process);
  const comment = await createProcessComment(id, {
    authorUserId: req.user.sub,
    authorRole: resolveAuthorRole(req),
    body,
  });
  sendSuccess(res, 'Comment added', comment, StatusCodes.CREATED);
}

/**
 * PATCH /vehicle-processes/:id/comments/:commentId — edit a comment. Only the author may edit their
 * own comment (editing another's content would misrepresent authorship).
 */
export async function updateProcessCommentHandler(req: Request, res: Response): Promise<void> {
  const { id, commentId } = req.params as unknown as ProcessCommentIdParams;
  const { body } = req.body as UpdateProcessCommentBody;
  const process = await getVehicleProcessById(id);
  await assertCanAccessProcess(req, process);
  const comment = await getProcessCommentOnProcess(id, commentId);
  if (comment.authorUserId !== req.user.sub) {
    throw new AppError('You can only edit your own comment', StatusCodes.FORBIDDEN, 4062);
  }
  const updated = await updateProcessComment(commentId, body);
  sendSuccess(res, 'Comment updated', updated);
}

/**
 * DELETE /vehicle-processes/:id/comments/:commentId — delete a comment. The author may delete their
 * own; a super-admin may delete any (moderation).
 */
export async function deleteProcessCommentHandler(req: Request, res: Response): Promise<void> {
  const { id, commentId } = req.params as unknown as ProcessCommentIdParams;
  const process = await getVehicleProcessById(id);
  await assertCanAccessProcess(req, process);
  const comment = await getProcessCommentOnProcess(id, commentId);
  const isAuthor = comment.authorUserId === req.user.sub;
  if (!isAuthor && !req.user.isSuperAdmin) {
    throw new AppError('You can only delete your own comment', StatusCodes.FORBIDDEN, 4062);
  }
  await deleteProcessComment(commentId);
  sendSuccess(res, 'Comment deleted', {});
}
