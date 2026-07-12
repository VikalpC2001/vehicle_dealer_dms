import { StatusCodes } from 'http-status-codes';
import type { ProcessTask } from '@prisma/client';
import * as processTaskRepository from '../repositories/process-task.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import * as userRepository from '../repositories/user.repository';
import { AppError } from '../utils/app-error';

export interface CreateProcessTaskInput {
  processId: string;
  taskName: string;
  taskDate: string;
  assignUserId?: string | null;
  status?: string;
}

export interface UpdateProcessTaskInput {
  taskName: string;
  taskDate: string;
  assignUserId?: string | null;
  status?: string;
}

/** Default status applied to a task when none is provided. */
const DEFAULT_TASK_STATUS = 'To-Do';

/**
 * Ensures the vehicle process exists and belongs to `dealerId`.
 */
const assertProcessOwnedByDealer = async (
  processId: string,
  dealerId: string,
): Promise<void> => {
  const proc = await vehicleProcessRepository.findVehicleProcessById(processId);
  if (!proc) {
    throw new AppError('Vehicle process not found', StatusCodes.NOT_FOUND, 4050);
  }
  if (!proc.dealerId || proc.dealerId !== dealerId) {
    throw new AppError('You do not have access to this vehicle process', StatusCodes.FORBIDDEN, 4034);
  }
};

/**
 * Ensures `assignUserId` references an existing user when set.
 */
const assertAssigneeExists = async (assignUserId: string | null | undefined): Promise<void> => {
  if (assignUserId === undefined || assignUserId === null) {
    return;
  }
  const user = await userRepository.findUserById(assignUserId);
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND, 4045);
  }
};

/**
 * Parses ISO date string into `Date`, or throws.
 */
const parseTaskDate = (value: string): Date => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('Invalid task date', StatusCodes.UNPROCESSABLE_ENTITY, 4229);
  }
  return d;
};

/**
 * Loads the task and ensures its process belongs to `dealerId`.
 */
const getTaskForDealerOrThrow = async (
  processTaskId: string,
  dealerId: string,
): Promise<ProcessTask> => {
  const row = await processTaskRepository.findProcessTaskById(processTaskId);
  if (!row) {
    throw new AppError('Process task not found', StatusCodes.NOT_FOUND, 4057);
  }
  await assertProcessOwnedByDealer(row.processId, dealerId);
  return row;
};

/**
 * Creates a task for a dealer-scoped vehicle process.
 *
 * @param dealerId - Resolved dealer scope.
 * @param input - Task fields; `assignUserId` optional.
 */
export async function createProcessTask(
  dealerId: string,
  input: CreateProcessTaskInput,
): Promise<ProcessTask> {
  await assertProcessOwnedByDealer(input.processId, dealerId);
  await assertAssigneeExists(input.assignUserId ?? null);
  return processTaskRepository.createProcessTask({
    processId: input.processId,
    taskName: input.taskName.trim(),
    taskDate: parseTaskDate(input.taskDate),
    assignUserId: input.assignUserId ?? null,
    status: input.status?.trim() || DEFAULT_TASK_STATUS,
  });
}

/**
 * Lists tasks for a process (dealer-scoped).
 */
export async function listProcessTasksByProcess(
  dealerId: string,
  processId: string,
): Promise<ProcessTask[]> {
  await assertProcessOwnedByDealer(processId, dealerId);
  return processTaskRepository.listProcessTasksByProcessId(processId);
}

/**
 * Returns one task if its process belongs to the dealer.
 */
export async function getProcessTaskById(
  dealerId: string,
  processTaskId: string,
): Promise<ProcessTask> {
  return getTaskForDealerOrThrow(processTaskId, dealerId);
}

/**
 * Updates a task (dealer-scoped).
 */
export async function updateProcessTask(
  dealerId: string,
  processTaskId: string,
  input: UpdateProcessTaskInput,
): Promise<ProcessTask> {
  await getTaskForDealerOrThrow(processTaskId, dealerId);
  await assertAssigneeExists(input.assignUserId ?? null);
  return processTaskRepository.updateProcessTask(processTaskId, {
    taskName: input.taskName.trim(),
    taskDate: parseTaskDate(input.taskDate),
    assignUserId: input.assignUserId ?? null,
    status: input.status?.trim() || DEFAULT_TASK_STATUS,
  });
}

/**
 * Deletes a task (dealer-scoped).
 */
export async function deleteProcessTask(
  dealerId: string,
  processTaskId: string,
): Promise<void> {
  await getTaskForDealerOrThrow(processTaskId, dealerId);
  await processTaskRepository.deleteProcessTask(processTaskId);
}
