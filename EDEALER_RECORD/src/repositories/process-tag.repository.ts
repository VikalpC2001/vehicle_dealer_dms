import { prisma } from '../config/prisma';

/**
 * A tag as exposed on a process (the flat shape shared across every read: process list, process
 * detail, and the task board/history cards).
 */
export interface ProcessTagDto {
  tagId: string;
  tagName: string;
  colour: string | null;
}

/**
 * Returns a process's tags in the flat `{ tagId, tagName, colour }` shape, ordered by tagName.
 *
 * @param processId - Vehicle process UUID.
 */
export async function listTagsForProcess(processId: string): Promise<ProcessTagDto[]> {
  const rows = await prisma.processTag.findMany({
    where: { processId },
    select: { tag: { select: { tagId: true, tagName: true, colour: true } } },
    orderBy: { tag: { tagName: 'asc' } },
  });
  return rows.map((row) => row.tag);
}

/**
 * Replaces a process's tag set in one transaction: removes every existing ProcessTag row for the
 * process, then inserts the given tagIds (`skipDuplicates` guards the composite PK). An empty
 * `tagIds` clears all tags. Returns the resulting tags in the flat DTO shape.
 *
 * Callers must have already verified that every tagId belongs to the process's dealer.
 *
 * @param processId - Vehicle process UUID.
 * @param tagIds - The full replacement set of dealer tag UUIDs (may be empty).
 */
export async function setProcessTags(
  processId: string,
  tagIds: string[],
): Promise<ProcessTagDto[]> {
  await prisma.$transaction(async (tx) => {
    await tx.processTag.deleteMany({ where: { processId } });
    if (tagIds.length > 0) {
      await tx.processTag.createMany({
        data: tagIds.map((tagId) => ({ processId, tagId })),
        skipDuplicates: true,
      });
    }
  });
  return listTagsForProcess(processId);
}
