import { prisma } from '../config/prisma';
import type { ProcessReference, ReferenceType } from '@prisma/client';

/** Insert one process reference row. */
export interface CreateProcessReferenceData {
  processId: string;
  referenceId: string;
  dealerId: string;
  referenceType: ReferenceType;
}

/**
 * Inserts many process reference rows in one transaction.
 *
 * @param rows - Process reference rows to create.
 */
export async function createManyProcessReferences(
  rows: CreateProcessReferenceData[],
): Promise<ProcessReference[]> {
  if (rows.length === 0) {
    return [];
  }

  return prisma.$transaction(
    rows.map((row) =>
      prisma.processReference.create({
        data: {
          processId: row.processId,
          referenceId: row.referenceId,
          dealerId: row.dealerId,
          referenceType: row.referenceType,
        },
      }),
    ),
  );
}

/**
 * Lists process references for a vehicle process, oldest first.
 *
 * @param processId - Vehicle process UUID.
 */
export async function listProcessReferencesByProcessId(
  processId: string,
): Promise<ProcessReference[]> {
  return prisma.processReference.findMany({
    where: { processId },
    orderBy: { createdAt: 'asc' },
  });
}
