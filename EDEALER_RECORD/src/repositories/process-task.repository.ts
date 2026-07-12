import { prisma } from '../config/prisma';
import type { ProcessTask } from '@prisma/client';

/** Fields to insert a task row. */
export interface CreateProcessTaskData {
  processId: string;
  taskName: string;
  taskDate: Date;
  assignUserId: string | null;
  status: string;
}

/** Mutable fields on update. */
export interface UpdateProcessTaskData {
  taskName: string;
  taskDate: Date;
  assignUserId: string | null;
  status: string;
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
