import { z } from 'zod';

/**
 * Money amount: positive, at most 2 decimal places, within Decimal(14,2). The decimal-place
 * check is on the string form (shortest round-trippable) — `Math.round(v*100)===v*100` gives
 * float false-negatives (e.g. 19.99*100 = 1998.9999…) that reject valid rupee amounts.
 */
const amountField = z.coerce
  .number()
  .positive('Amount must be greater than zero')
  .max(999_999_999_999.99, 'Amount is too large')
  .refine((v) => Number.isFinite(v) && /^\d+(\.\d{1,2})?$/.test(v.toString()), 'At most 2 decimal places');

const expenseBodyFields = {
  label: z.string().trim().min(1, 'Label is required').max(255),
  amount: amountField,
  category: z.string().trim().max(50).nullish(),
};

export const createProcessExpenseSchema = z.object({
  body: z.object({
    processId: z.string().uuid('Invalid process ID'),
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    ...expenseBodyFields,
  }),
});

export const updateProcessExpenseSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid expense ID') }),
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    ...expenseBodyFields,
  }),
});

export const listProcessExpensesSchema = z.object({
  query: z.object({
    processId: z.string().uuid('Invalid process ID'),
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export const processExpenseIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid expense ID') }),
});

export type CreateProcessExpenseBody = z.infer<typeof createProcessExpenseSchema>['body'];
export type UpdateProcessExpenseBody = z.infer<typeof updateProcessExpenseSchema>['body'];
export type ProcessExpenseIdParams = z.infer<typeof processExpenseIdSchema>['params'];
