import { StatusCodes } from 'http-status-codes';
import type { CommentAuthorRole, TaskComment } from '@prisma/client';
import * as taskCommentRepository from '../repositories/task-comment.repository';
import type { TaskCommentWithAuthor } from '../repositories/task-comment.repository';
import { AppError } from '../utils/app-error';

/** Serializable comment for the shared task thread. */
export interface TaskCommentDto {
  commentId: string;
  processTaskId: string;
  authorUserId: string | null;
  authorName: string | null;
  authorRole: CommentAuthorRole;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields the caller (controller) resolves from the token before creating a comment. */
export interface CreateTaskCommentInput {
  authorUserId: string;
  authorRole: CommentAuthorRole;
  body: string;
}

/** Maps a repository comment row (with author) to the response DTO. */
const toDto = (row: TaskCommentWithAuthor): TaskCommentDto => ({
  commentId: row.commentId,
  processTaskId: row.processTaskId,
  authorUserId: row.authorUserId,
  authorName: row.author?.userName ?? null,
  authorRole: row.authorRole,
  body: row.body,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Lists the shared comment thread for a task (oldest first). The caller's access to the task is
 * asserted by the controller before this call.
 *
 * @param processTaskId - Process task UUID.
 */
export async function listTaskComments(processTaskId: string): Promise<TaskCommentDto[]> {
  const rows = await taskCommentRepository.listCommentsForTask(processTaskId);
  return rows.map(toDto);
}

/**
 * Posts a comment to a task's shared thread. Access + author identity are resolved by the
 * controller from the token.
 *
 * @param processTaskId - Process task UUID.
 * @param input - Author id/role and the (already validated) comment body.
 */
export async function createTaskComment(
  processTaskId: string,
  input: CreateTaskCommentInput,
): Promise<TaskCommentDto> {
  const created = await taskCommentRepository.createTaskComment({
    processTaskId,
    authorUserId: input.authorUserId,
    authorRole: input.authorRole,
    body: input.body.trim(),
  });
  return toDto(created);
}

/**
 * Loads a comment and asserts it belongs to the given task (so a comment id from one task can't be
 * edited/deleted via another task's URL). The caller (controller) then checks authorship.
 *
 * @param processTaskId - The task the comment must belong to.
 * @param commentId - Comment UUID.
 * @throws AppError 404/4040 when the comment is missing or not on this task.
 */
export async function getTaskCommentOnTask(
  processTaskId: string,
  commentId: string,
): Promise<TaskComment> {
  const comment = await taskCommentRepository.findCommentById(commentId);
  if (!comment || comment.processTaskId !== processTaskId) {
    throw new AppError('Comment not found', StatusCodes.NOT_FOUND, 4040);
  }
  return comment;
}

/**
 * Updates a comment's body. Access + authorship are asserted by the controller before this call.
 *
 * @param commentId - Comment UUID.
 * @param body - New (already validated) comment text.
 */
export async function updateTaskComment(commentId: string, body: string): Promise<TaskCommentDto> {
  const updated = await taskCommentRepository.updateTaskComment(commentId, body.trim());
  return toDto(updated);
}

/**
 * Deletes a comment. Access + authorship (author or super-admin) are asserted by the controller.
 *
 * @param commentId - Comment UUID.
 */
export async function deleteTaskComment(commentId: string): Promise<void> {
  await taskCommentRepository.deleteTaskComment(commentId);
}
