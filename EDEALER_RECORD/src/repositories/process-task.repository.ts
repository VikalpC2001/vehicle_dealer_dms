import { prisma } from '../config/prisma';
import type { ProcessTask, Prisma } from '@prisma/client';

/** Fields to insert a task row. */
export interface CreateProcessTaskData {
  processId: string;
  taskName: string;
  taskDate: Date;
  assignUserId: string | null;
  status: string;
  completedAt: Date | null;
}

/** Mutable fields on update. */
export interface UpdateProcessTaskData {
  taskName: string;
  taskDate: Date;
  assignUserId: string | null;
  status: string;
  completedAt: Date | null;
}

/**
 * Inserts a process task.
 *
 * @param data - Row payload.
 */
export async function createProcessTask(data: CreateProcessTaskData): Promise<ProcessTask> {
  return prisma.processTask.create({
    data: {
      processId: data.processId,
      taskName: data.taskName,
      taskDate: data.taskDate,
      assignUserId: data.assignUserId,
      status: data.status,
      completedAt: data.completedAt,
    },
  });
}

/**
 * Finds by primary key.
 *
 * @param processTaskId - UUID.
 */
export async function findProcessTaskById(processTaskId: string): Promise<ProcessTask | null> {
  return prisma.processTask.findUnique({
    where: { processTaskId },
  });
}

/**
 * Lists tasks for a process, ordered by `taskDate` then `createdAt`.
 *
 * @param processId - Vehicle process UUID.
 */
export async function listProcessTasksByProcessId(processId: string): Promise<ProcessTask[]> {
  return prisma.processTask.findMany({
    where: { processId },
    orderBy: [{ taskDate: 'asc' }, { createdAt: 'asc' }],
  });
}

/** Relations selected for a board row: parent process (+ vehicle registration, tags) and assignee. */
const boardTaskInclude = {
  process: {
    select: {
      processId: true,
      vehicle: { select: { registrationNumber: true } },
      processTags: {
        select: { tag: { select: { tagId: true, tagName: true, colour: true } } },
        orderBy: { tag: { tagName: 'asc' } },
      },
    },
  },
  assignUser: { select: { userId: true, userName: true } },
} satisfies Prisma.ProcessTaskInclude;

/** A process task joined with the fields the dealer task board needs. */
export type ProcessTaskBoardRow = Prisma.ProcessTaskGetPayload<{ include: typeof boardTaskInclude }>;

/** Filters for the dealer-wide task board query. */
export interface ProcessTaskBoardFilters {
  status?: string;
  assignUserId?: string;
  /** Lower bound for completed tasks; tasks completed before this are excluded. */
  completedSince: Date;
}

/**
 * Lists tasks across all of a dealer's processes for the Jira-like board. Includes not-yet-completed
 * tasks plus tasks completed on/after `completedSince`; ordered by `taskDate` then `createdAt`.
 *
 * @param dealerId - Dealer whose processes' tasks to list.
 * @param filters - Optional `status`/`assignUserId` filters and the `completedSince` window bound.
 */
export async function listProcessTasksForDealerBoard(
  dealerId: string,
  filters: ProcessTaskBoardFilters,
): Promise<ProcessTaskBoardRow[]> {
  return prisma.processTask.findMany({
    where: {
      // `deletedAt: null` keeps tasks of binned (soft-deleted) processes off the board.
      process: { dealerId, deletedAt: null },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assignUserId ? { assignUserId: filters.assignUserId } : {}),
      OR: [{ completedAt: null }, { completedAt: { gte: filters.completedSince } }],
    },
    include: boardTaskInclude,
    // Last-created task first, so the newest task sits at the top of each board column.
    orderBy: { createdAt: 'desc' },
  });
}

/** Filters + pagination window for the dealer's completed-task history query. */
export interface ProcessTaskHistoryFilters {
  assignUserId?: string;
  skip: number;
  take: number;
}

/**
 * Lists a dealer's COMPLETED tasks (`completedAt != null`) across all their processes — the all-time
 * history, newest completion first — with a matching total for pagination. Optional `assignUserId`
 * narrows to one assignee.
 *
 * @param dealerId - Dealer whose processes' completed tasks to list.
 * @param filters - Optional `assignUserId` plus `skip`/`take` pagination window.
 */
export async function listCompletedProcessTasksForDealer(
  dealerId: string,
  filters: ProcessTaskHistoryFilters,
): Promise<{ rows: ProcessTaskBoardRow[]; total: number }> {
  const where: Prisma.ProcessTaskWhereInput = {
    // `deletedAt: null` keeps completed tasks of binned processes out of the history.
    process: { dealerId, deletedAt: null },
    completedAt: { not: null },
    ...(filters.assignUserId ? { assignUserId: filters.assignUserId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.processTask.findMany({
      where,
      include: boardTaskInclude,
      orderBy: { completedAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.processTask.count({ where }),
  ]);
  return { rows, total };
}

/**
 * Updates a task row.
 *
 * @param processTaskId - Primary key.
 * @param data - Replacement values.
 */
export async function updateProcessTask(
  processTaskId: string,
  data: UpdateProcessTaskData,
): Promise<ProcessTask> {
  return prisma.processTask.update({
    where: { processTaskId },
    data: {
      taskName: data.taskName,
      taskDate: data.taskDate,
      assignUserId: data.assignUserId,
      status: data.status,
      completedAt: data.completedAt,
    },
  });
}

/**
 * Deletes a task row.
 *
 * @param processTaskId - Primary key.
 */
export async function deleteProcessTask(processTaskId: string): Promise<ProcessTask> {
  return prisma.processTask.delete({
    where: { processTaskId },
  });
}
