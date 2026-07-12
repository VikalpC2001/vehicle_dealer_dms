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
