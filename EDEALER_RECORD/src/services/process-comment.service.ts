import { StatusCodes } from 'http-status-codes';
import type { CommentAuthorRole, ProcessComment } from '@prisma/client';
import * as processCommentRepository from '../repositories/process-comment.repository';
import type { ProcessCommentWithAuthor } from '../repositories/process-comment.repository';
import { AppError } from '../utils/app-error';

/** Serializable comment for the shared process thread. */
export interface ProcessCommentDto {
  commentId: string;
  processId: string;
  authorUserId: string | null;
  authorName: string | null;
  authorRole: CommentAuthorRole;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields the caller (controller) resolves from the token before creating a comment. */
export interface CreateProcessCommentInput {
  authorUserId: string;
  authorRole: CommentAuthorRole;
  body: string;
}

/** Maps a repository comment row (with author) to the response DTO. */
const toDto = (row: ProcessCommentWithAuthor): ProcessCommentDto => ({
  commentId: row.commentId,
  processId: row.processId,
  authorUserId: row.authorUserId,
  authorName: row.author?.userName ?? null,
  authorRole: row.authorRole,
  body: row.body,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Lists the shared comment thread for a process (oldest first). The caller's access to the process
 * is asserted by the controller before this call.
 *
 * @param processId - Vehicle process UUID.
 */
export async function listProcessComments(processId: string): Promise<ProcessCommentDto[]> {
  const rows = await processCommentRepository.listCommentsForProcess(processId);
  return rows.map(toDto);
}

/**
 * Posts a comment to a process's shared thread. Access + author identity are resolved by the
 * controller from the token.
 *
 * @param processId - Vehicle process UUID.
 * @param input - Author id/role and the (already validated) comment body.
 */
export async function createProcessComment(
  processId: string,
  input: CreateProcessCommentInput,
): Promise<ProcessCommentDto> {
  const created = await processCommentRepository.createProcessComment({
    processId,
    authorUserId: input.authorUserId,
    authorRole: input.authorRole,
    body: input.body.trim(),
  });
  return toDto(created);
}

/**
 * Loads a comment and asserts it belongs to the given process (so a comment id from one process
 * can't be edited/deleted via another process's URL). The caller (controller) then checks authorship.
 *
 * @param processId - The process the comment must belong to.
 * @param commentId - Comment UUID.
 * @throws AppError 404/4040 when the comment is missing or not on this process.
 */
export async function getProcessCommentOnProcess(
  processId: string,
  commentId: string,
): Promise<ProcessComment> {
  const comment = await processCommentRepository.findCommentById(commentId);
  if (!comment || comment.processId !== processId) {
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
export async function updateProcessComment(
  commentId: string,
  body: string,
): Promise<ProcessCommentDto> {
  const updated = await processCommentRepository.updateProcessComment(commentId, body.trim());
  return toDto(updated);
}

/**
 * Deletes a comment. Access + authorship (author or super-admin) are asserted by the controller.
 *
 * @param commentId - Comment UUID.
 */
export async function deleteProcessComment(commentId: string): Promise<void> {
  await processCommentRepository.deleteProcessComment(commentId);
}
