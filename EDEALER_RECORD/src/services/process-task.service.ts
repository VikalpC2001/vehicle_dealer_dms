import { StatusCodes } from 'http-status-codes';
import type { ProcessTask } from '@prisma/client';
import * as processTaskRepository from '../repositories/process-task.repository';
import type { ProcessTagDto } from '../repositories/process-tag.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import * as dealerWiseUserRepository from '../repositories/dealer-wise-user.repository';
import * as dealerTaskStatusRepository from '../repositories/dealer-task-status.repository';
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

/** Rolling window (days) for how long completed tasks stay visible on the board. */
const COMPLETED_WINDOW_DAYS = 15;

/**
 * Resolves the `completedAt` stamp for a task whose (new) status is `status`, for the task's dealer.
 * If the status is a DONE column ({@link dealerTaskStatusRepository.isDoneStatus}), keeps an existing
 * stamp or sets `now()` the first time it enters done; otherwise clears it to `null`.
 *
 * @param dealerId - The task's process dealer (scope for the DONE-status lookup).
 * @param status - The resolved status the task is moving to.
 * @param existingCompletedAt - Current stamp (null on create).
 */
const resolveCompletedAt = async (
  dealerId: string,
  status: string,
  existingCompletedAt: Date | null,
): Promise<Date | null> => {
  const isDone = await dealerTaskStatusRepository.isDoneStatus(dealerId, status);
  if (!isDone) {
    return null;
  }
  return existingCompletedAt ?? new Date();
};

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
const assertAssigneeExists = async (
  dealerId: string,
  assignUserId: string | null | undefined,
): Promise<void> => {
  if (assignUserId === undefined || assignUserId === null) {
    return;
  }
  // The assignee must be one of THIS dealer's users — prevents cross-tenant assignment (and leaking
  // a foreign user's name onto the board). A DealerWiseUser links a user to exactly one dealer.
  const assigneeDealerId = await dealerWiseUserRepository.findFirstDealerIdByUserId(assignUserId);
  if (assigneeDealerId !== dealerId) {
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
  await assertAssigneeExists(dealerId, input.assignUserId ?? null);
  const status = input.status?.trim() || DEFAULT_TASK_STATUS;
  const completedAt = await resolveCompletedAt(dealerId, status, null);
  return processTaskRepository.createProcessTask({
    processId: input.processId,
    taskName: input.taskName.trim(),
    taskDate: parseTaskDate(input.taskDate),
    assignUserId: input.assignUserId ?? null,
    status,
    completedAt,
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
  const existing = await getTaskForDealerOrThrow(processTaskId, dealerId);
  await assertAssigneeExists(dealerId, input.assignUserId ?? null);
  const status = input.status?.trim() || DEFAULT_TASK_STATUS;
  const completedAt = await resolveCompletedAt(dealerId, status, existing.completedAt);
  return processTaskRepository.updateProcessTask(processTaskId, {
    taskName: input.taskName.trim(),
    taskDate: parseTaskDate(input.taskDate),
    assignUserId: input.assignUserId ?? null,
    status,
    completedAt,
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

/** Optional filters for the dealer-wide task board. */
export interface ProcessTaskBoardFilters {
  status?: string;
  assignUserId?: string;
  /** When true, restrict to the calling user's own assigned tasks (overrides `assignUserId`). */
  mine?: boolean;
}

/** A single card on the dealer task board. */
export interface ProcessTaskBoardItem {
  processTaskId: string;
  taskName: string;
  taskDate: Date;
  status: string;
  completedAt: Date | null;
  assignUserId: string | null;
  assignUserName: string | null;
  processId: string;
  vehicleRegistrationNumber: string | null;
  tags: ProcessTagDto[];
}

/** Maps a repository board row (task + process + assignee) to the flat board card DTO. */
const toBoardItem = (
  row: processTaskRepository.ProcessTaskBoardRow,
): ProcessTaskBoardItem => ({
  processTaskId: row.processTaskId,
  taskName: row.taskName,
  taskDate: row.taskDate,
  status: row.status,
  completedAt: row.completedAt,
  assignUserId: row.assignUserId,
  assignUserName: row.assignUser?.userName ?? null,
  processId: row.processId,
  vehicleRegistrationNumber: row.process.vehicle?.registrationNumber ?? null,
  tags: row.process.processTags.map((pt) => pt.tag),
});

/**
 * Lists the dealer's task board: all tasks across the dealer's processes that are either open or
 * were completed within the last {@link COMPLETED_WINDOW_DAYS} days. Applies optional status/assignee
 * filters; `filters.mine` pins the assignee to `selfUserId`.
 *
 * @param dealerId - Resolved dealer scope.
 * @param filters - Optional status/assignee filters and the `mine` toggle.
 * @param selfUserId - The calling user's id (`req.user.sub`), used when `filters.mine` is set.
 */
export async function listProcessTaskBoard(
  dealerId: string,
  filters: ProcessTaskBoardFilters,
  selfUserId: string,
): Promise<ProcessTaskBoardItem[]> {
  const completedSince = new Date(Date.now() - COMPLETED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const assignUserId = filters.mine ? selfUserId : filters.assignUserId;
  const rows = await processTaskRepository.listProcessTasksForDealerBoard(dealerId, {
    status: filters.status,
    assignUserId,
    completedSince,
  });
  return rows.map(toBoardItem);
}

/** Optional filters for the dealer's completed-task history. */
export interface ProcessTaskHistoryFilters {
  assignUserId?: string;
  /** When true, restrict to the calling user's own tasks (overrides `assignUserId`). */
  mine?: boolean;
}

/**
 * Lists the dealer's COMPLETED task history — all-time (not the {@link COMPLETED_WINDOW_DAYS} board
 * window), newest completion first, paginated. Shares the board card DTO. `filters.mine` pins the
 * assignee to `selfUserId`.
 *
 * @param dealerId - Resolved dealer scope.
 * @param filters - Optional assignee filter and the `mine` toggle.
 * @param selfUserId - The calling user's id (`req.user.sub`), used when `filters.mine` is set.
 * @param skip - Pagination offset.
 * @param take - Page size.
 */
export async function listProcessTaskHistory(
  dealerId: string,
  filters: ProcessTaskHistoryFilters,
  selfUserId: string,
  skip: number,
  take: number,
): Promise<{ items: ProcessTaskBoardItem[]; total: number }> {
  const assignUserId = filters.mine ? selfUserId : filters.assignUserId;
  const { rows, total } = await processTaskRepository.listCompletedProcessTasksForDealer(dealerId, {
    assignUserId,
    skip,
    take,
  });
  return { items: rows.map(toBoardItem), total };
}
