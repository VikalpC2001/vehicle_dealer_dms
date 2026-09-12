import { z } from 'zod';

/** GET /vehicle-processes/:id/comments — the process id is the thread anchor. */
export const listProcessCommentsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
});

/** POST /vehicle-processes/:id/comments — a single non-empty comment body. */
export const createProcessCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
  body: z.object({
    body: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment is too long'),
  }),
});

/** PATCH /vehicle-processes/:id/comments/:commentId — edit one's own comment. */
export const updateProcessCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
    commentId: z.string().uuid('Invalid comment ID'),
  }),
  body: z.object({
    body: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment is too long'),
  }),
});

/** DELETE /vehicle-processes/:id/comments/:commentId. */
export const deleteProcessCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
    commentId: z.string().uuid('Invalid comment ID'),
  }),
});

export type ProcessCommentParams = z.infer<typeof listProcessCommentsSchema>['params'];
export type CreateProcessCommentBody = z.infer<typeof createProcessCommentSchema>['body'];
export type ProcessCommentIdParams = z.infer<typeof deleteProcessCommentSchema>['params'];
export type UpdateProcessCommentBody = z.infer<typeof updateProcessCommentSchema>['body'];
