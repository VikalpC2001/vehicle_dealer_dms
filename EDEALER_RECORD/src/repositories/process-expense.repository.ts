import { prisma } from '../config/prisma';
import type { ProcessExpense } from '@prisma/client';

/** Fields required to insert a process-expense row (`processId` is the parent FK). */
export interface CreateProcessExpenseData {
  processId: string;
  label: string;
  amount: number;
  category: string | null;
}

/** Mutable fields on a process-expense row (the parent process is never reassigned). */
export interface UpdateProcessExpenseData {
  label: string;
  amount: number;
  category: string | null;
}

/**
 * Inserts a process-expense row.
 * @param data - Expense fields including the parent `processId`.
 */
export async function createProcessExpense(
  data: CreateProcessExpenseData,
): Promise<ProcessExpense> {
  return prisma.processExpense.create({
    data: {
      processId: data.processId,
      label: data.label,
      amount: data.amount,
      category: data.category,
    },
  });
}

/**
 * Finds a process-expense by id, or `null` if it does not exist.
 * @param expenseId - Expense UUID.
 */
export async function findProcessExpenseById(
  expenseId: string,
): Promise<ProcessExpense | null> {
  return prisma.processExpense.findUnique({ where: { expenseId } });
}

/**
 * Lists all expenses for a process, oldest first.
 * @param processId - Vehicle process UUID.
 */
export async function listProcessExpensesByProcessId(
  processId: string,
): Promise<ProcessExpense[]> {
  return prisma.processExpense.findMany({
    where: { processId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Updates a process-expense row.
 * @param expenseId - Expense UUID.
 * @param data - New label / amount / category.
 */
export async function updateProcessExpense(
  expenseId: string,
  data: UpdateProcessExpenseData,
): Promise<ProcessExpense> {
  return prisma.processExpense.update({
    where: { expenseId },
    data: {
      label: data.label,
      amount: data.amount,
      category: data.category,
    },
  });
}

/**
 * Deletes a process-expense row.
 * @param expenseId - Expense UUID.
 */
export async function deleteProcessExpense(expenseId: string): Promise<ProcessExpense> {
  return prisma.processExpense.delete({ where: { expenseId } });
}
