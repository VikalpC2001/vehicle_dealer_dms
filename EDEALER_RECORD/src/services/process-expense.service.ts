import { StatusCodes } from 'http-status-codes';
import type { ProcessExpense } from '@prisma/client';
import * as processExpenseRepository from '../repositories/process-expense.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import { AppError } from '../utils/app-error';

export interface CreateProcessExpenseInput {
  processId: string;
  label: string;
  amount: number;
  category?: string | null;
}

export interface UpdateProcessExpenseInput {
  label: string;
  amount: number;
  category?: string | null;
}

/** Ensures the vehicle process exists and belongs to `dealerId` (tenancy guard). */
const assertProcessOwnedByDealer = async (processId: string, dealerId: string): Promise<void> => {
  const proc = await vehicleProcessRepository.findVehicleProcessById(processId);
  if (!proc) {
    throw new AppError('Vehicle process not found', StatusCodes.NOT_FOUND, 4050);
  }
  if (!proc.dealerId || proc.dealerId !== dealerId) {
    throw new AppError('You do not have access to this vehicle process', StatusCodes.FORBIDDEN, 4034);
  }
};

/** Loads an expense and ensures its parent process belongs to `dealerId`. */
const getExpenseForDealerOrThrow = async (
  expenseId: string,
  dealerId: string,
): Promise<ProcessExpense> => {
  const expense = await processExpenseRepository.findProcessExpenseById(expenseId);
  if (!expense) {
    throw new AppError('Expense not found', StatusCodes.NOT_FOUND, 4060);
  }
  await assertProcessOwnedByDealer(expense.processId, dealerId);
  return expense;
};

/**
 * Creates an expense on a process the caller owns.
 * @param dealerId - Resolved dealer from the JWT / admin query.
 * @param input - Expense fields incl. the target `processId`.
 */
export async function createProcessExpense(
  dealerId: string,
  input: CreateProcessExpenseInput,
): Promise<ProcessExpense> {
  await assertProcessOwnedByDealer(input.processId, dealerId);
  return processExpenseRepository.createProcessExpense({
    processId: input.processId,
    label: input.label,
    amount: input.amount,
    category: input.category?.trim() || null,
  });
}

/**
 * Lists a process's expenses (dealer-scoped).
 * @param dealerId - Resolved dealer.
 * @param processId - Vehicle process UUID.
 */
export async function listProcessExpensesByProcess(
  dealerId: string,
  processId: string,
): Promise<ProcessExpense[]> {
  await assertProcessOwnedByDealer(processId, dealerId);
  return processExpenseRepository.listProcessExpensesByProcessId(processId);
}

/**
 * Fetches a single expense the caller owns.
 * @param dealerId - Resolved dealer.
 * @param expenseId - Expense UUID.
 */
export async function getProcessExpenseById(
  dealerId: string,
  expenseId: string,
): Promise<ProcessExpense> {
  return getExpenseForDealerOrThrow(expenseId, dealerId);
}

/**
 * Updates an expense the caller owns.
 * @param dealerId - Resolved dealer.
 * @param expenseId - Expense UUID.
 * @param input - New label / amount / category.
 */
export async function updateProcessExpense(
  dealerId: string,
  expenseId: string,
  input: UpdateProcessExpenseInput,
): Promise<ProcessExpense> {
  await getExpenseForDealerOrThrow(expenseId, dealerId);
  return processExpenseRepository.updateProcessExpense(expenseId, {
    label: input.label,
    amount: input.amount,
    category: input.category?.trim() || null,
  });
}

/**
 * Deletes an expense the caller owns.
 * @param dealerId - Resolved dealer.
 * @param expenseId - Expense UUID.
 */
export async function deleteProcessExpense(dealerId: string, expenseId: string): Promise<void> {
  await getExpenseForDealerOrThrow(expenseId, dealerId);
  await processExpenseRepository.deleteProcessExpense(expenseId);
}
