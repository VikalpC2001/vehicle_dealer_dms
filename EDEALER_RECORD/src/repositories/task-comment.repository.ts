import { prisma } from '../config/prisma';
import type { CommentAuthorRole, TaskComment } from '@prisma/client';

/** A comment row with its (optional) author summary for display. */
export type TaskCommentWithAuthor = TaskComment & {
  author: { userId: string; userName: string } | null;
};

/**
 * Data required to create a task comment. `authorRole` is derived from the caller's token by the
 * service/controller; `authorUserId` is the caller's user id (nulled if that user is later deleted).
 */
export interface CreateTaskCommentData {
  processTaskId: string;
  authorUserId: string;
  authorRole: CommentAuthorRole;
  body: string;
}

/** Shared `select` for the author summary attached to each comment. */
const authorSelect = { userId: true, userName: true } as const;

/**
 * Lists all comments on a task, oldest first (thread order), each with its author summary.
 *
 * @param processTaskId - Process task UUID.
 */
export async function listCommentsForTask(processTaskId: string): Promise<TaskCommentWithAuthor[]> {
  return prisma.taskComment.findMany({
    where: { processTaskId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: authorSelect } },
  });
}

/**
 * Creates a comment on a task and returns it with the author summary.
 *
 * @param data - Task id, author id/role, and the comment body.
 */
export async function createTaskComment(data: CreateTaskCommentData): Promise<TaskCommentWithAuthor> {
  return prisma.taskComment.create({
    data: {
      processTaskId: data.processTaskId,
      authorUserId: data.authorUserId,
      authorRole: data.authorRole,
      body: data.body,
    },
    include: { author: { select: authorSelect } },
  });
}

/**
 * Finds a single comment by id (raw row, no author include), or `null`. Used to authorize an
 * edit/delete: check the comment belongs to the URL task and to the caller.
 *
 * @param commentId - Comment UUID.
 */
export async function findCommentById(commentId: string): Promise<TaskComment | null> {
  return prisma.taskComment.findUnique({ where: { commentId } });
}

/**
 * Updates a comment's body and returns it with the author summary. Ownership is enforced by the
 * service/controller before this call.
 *
 * @param commentId - Comment UUID.
 * @param body - New comment text.
 */
export async function updateTaskComment(
  commentId: string,
  body: string,
): Promise<TaskCommentWithAuthor> {
  return prisma.taskComment.update({
    where: { commentId },
    data: { body },
    include: { author: { select: authorSelect } },
  });
}

/**
 * Deletes a comment. Ownership (author or super-admin) is enforced before this call.
 *
 * @param commentId - Comment UUID.
 */
export async function deleteTaskComment(commentId: string): Promise<void> {
  await prisma.taskComment.delete({ where: { commentId } });
}
