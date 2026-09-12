import { prisma } from '../config/prisma';
import type { CommentAuthorRole, ProcessComment } from '@prisma/client';

/** A comment row with its (optional) author summary for display. */
export type ProcessCommentWithAuthor = ProcessComment & {
  author: { userId: string; userName: string } | null;
};

/**
 * Data required to create a process comment. `authorRole` is derived from the caller's token by the
 * service/controller; `authorUserId` is the caller's user id (nulled if that user is later deleted).
 */
export interface CreateProcessCommentData {
  processId: string;
  authorUserId: string;
  authorRole: CommentAuthorRole;
  body: string;
}

/** Shared `select` for the author summary attached to each comment. */
const authorSelect = { userId: true, userName: true } as const;

/**
 * Lists all comments on a process, oldest first (thread order), each with its author summary.
 *
 * @param processId - Vehicle process UUID.
 */
export async function listCommentsForProcess(
  processId: string,
): Promise<ProcessCommentWithAuthor[]> {
  return prisma.processComment.findMany({
    where: { processId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: authorSelect } },
  });
}

/**
 * Creates a comment on a process and returns it with the author summary.
 *
 * @param data - Process id, author id/role, and the comment body.
 */
export async function createProcessComment(
  data: CreateProcessCommentData,
): Promise<ProcessCommentWithAuthor> {
  return prisma.processComment.create({
    data: {
      processId: data.processId,
      authorUserId: data.authorUserId,
      authorRole: data.authorRole,
      body: data.body,
    },
    include: { author: { select: authorSelect } },
  });
}

/**
 * Finds a single comment by id (raw row, no author include), or `null`. Used to authorize an
 * edit/delete: check the comment belongs to the URL process and to the caller.
 *
 * @param commentId - Comment UUID.
 */
export async function findCommentById(commentId: string): Promise<ProcessComment | null> {
  return prisma.processComment.findUnique({ where: { commentId } });
}

/**
 * Updates a comment's body and returns it with the author summary. Ownership is enforced by the
 * service/controller before this call.
 *
 * @param commentId - Comment UUID.
 * @param body - New comment text.
 */
export async function updateProcessComment(
  commentId: string,
  body: string,
): Promise<ProcessCommentWithAuthor> {
  return prisma.processComment.update({
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
export async function deleteProcessComment(commentId: string): Promise<void> {
  await prisma.processComment.delete({ where: { commentId } });
}
