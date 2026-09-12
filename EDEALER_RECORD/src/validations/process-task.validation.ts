import { z } from 'zod';

const taskDateField = z
  .string()
  .min(1, 'Task date is required')
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid task date' });

const assignUserIdField = z.union([z.string().uuid('Invalid assign user ID'), z.null()]).optional();

const taskBodyFields = {
  taskName: z.string().min(1, 'Task name is required').max(512),
  taskDate: taskDateField,
  assignUserId: assignUserIdField,
  status: z.string().min(1, 'Status is required').max(50).optional(),
};

const processIdField = z.string().uuid('Invalid process ID');

export const createProcessTaskSchema = z.object({
  body: z.object({
    processId: processIdField,
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    ...taskBodyFields,
  }),
});

export const listProcessTasksSchema = z.object({
  query: z.object({
    processId: processIdField,
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

/** Query-string boolean: 'true'/'false' (or real booleans) → boolean; optional. */
const booleanQueryField = z
  .preprocess((v) => {
    if (v === 'true' || v === true) return true;
    if (v === 'false' || v === false) return false;
    return v;
  }, z.boolean())
  .optional();

export const listProcessTaskBoardSchema = z.object({
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    assignUserId: z.string().uuid('Invalid assign user ID').optional(),
    mine: booleanQueryField,
    status: z.string().min(1).max(50).optional(),
  }),
});

export const listProcessTaskHistorySchema = z.object({
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    assignUserId: z.string().uuid('Invalid assign user ID').optional(),
    mine: booleanQueryField,
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const getProcessTaskByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process task ID'),
  }),
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export const updateProcessTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process task ID'),
  }),
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
  body: z.object(taskBodyFields),
});

export const deleteProcessTaskSchema = getProcessTaskByIdSchema;

export type CreateProcessTaskBody = z.infer<typeof createProcessTaskSchema>['body'];
export type UpdateProcessTaskBody = z.infer<typeof updateProcessTaskSchema>['body'];
export type ProcessTaskIdParams = z.infer<typeof getProcessTaskByIdSchema>['params'];
export type ListProcessTaskBoardQuery = z.infer<typeof listProcessTaskBoardSchema>['query'];
export type ListProcessTaskHistoryQuery = z.infer<typeof listProcessTaskHistorySchema>['query'];
