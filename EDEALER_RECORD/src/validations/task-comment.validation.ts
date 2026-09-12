import { z } from 'zod';

/** Optional `dealerId` in the query — lets a managing agent (or super-admin) scope the task. */
const dealerScopeQuery = z.object({
  dealerId: z.string().uuid('Invalid dealer ID').optional(),
});

/** A single non-empty comment body, shared by create/update. */
const commentBody = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment is too long'),
});

/** GET /process-tasks/:id/comments — the task id is the thread anchor. */
export const listTaskCommentsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
  }),
  query: dealerScopeQuery,
});

/** POST /process-tasks/:id/comments — a single non-empty comment body. */
export const createTaskCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
  }),
  query: dealerScopeQuery,
  body: commentBody,
});

/** PATCH /process-tasks/:id/comments/:commentId — edit one's own comment. */
export const updateTaskCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
    commentId: z.string().uuid('Invalid comment ID'),
  }),
  query: dealerScopeQuery,
  body: commentBody,
});

/** DELETE /process-tasks/:id/comments/:commentId. */
export const deleteTaskCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
    commentId: z.string().uuid('Invalid comment ID'),
  }),
  query: dealerScopeQuery,
});

export type TaskCommentParams = z.infer<typeof listTaskCommentsSchema>['params'];
export type CreateTaskCommentBody = z.infer<typeof createTaskCommentSchema>['body'];
export type TaskCommentIdParams = z.infer<typeof deleteTaskCommentSchema>['params'];
export type UpdateTaskCommentBody = z.infer<typeof updateTaskCommentSchema>['body'];
