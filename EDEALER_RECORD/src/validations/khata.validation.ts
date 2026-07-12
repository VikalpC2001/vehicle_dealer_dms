import { z } from 'zod';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/** Money amount: positive, at most 2 decimal places, within Decimal(14,2). */
const amountField = z.coerce
  .number()
  .positive('Amount must be greater than zero')
  .max(999_999_999_999.99, 'Amount is too large')
  // Check decimals on the string form (shortest round-trippable) — `Math.round(v*100)===v*100`
  // gives float false-negatives (e.g. 19.99*100 = 1998.9999…) that reject valid rupee amounts.
  .refine((v) => Number.isFinite(v) && /^\d+(\.\d{1,2})?$/.test(v.toString()), 'At most 2 decimal places');

export const listAccountsSchema = z.object({
  query: paginationQuery,
});

export const statementSchema = z.object({
  params: z.object({ counterpartyId: z.string().uuid('Invalid id') }),
  query: paginationQuery,
});

export const postEntrySchema = z.object({
  body: z.object({
    counterpartyId: z.string().uuid('Invalid counterparty id'),
    direction: z.enum(['CREDIT', 'DEBIT']),
    amount: amountField,
    description: z.string().trim().max(2000).optional(),
    assignmentId: z.string().uuid('Invalid assignment id').optional(),
  }),
});

export const entryIdParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid entry id') }),
});

export const settleSchema = z.object({
  params: z.object({ counterpartyId: z.string().uuid('Invalid id') }),
  body: z.object({ amount: amountField.optional() }),
});

export type ListAccountsQuery = z.infer<typeof listAccountsSchema>['query'];
export type StatementParams = z.infer<typeof statementSchema>['params'];
export type StatementQuery = z.infer<typeof statementSchema>['query'];
export type PostEntryBody = z.infer<typeof postEntrySchema>['body'];
export type EntryIdParams = z.infer<typeof entryIdParamsSchema>['params'];
export type SettleParams = z.infer<typeof settleSchema>['params'];
export type SettleBody = z.infer<typeof settleSchema>['body'];
