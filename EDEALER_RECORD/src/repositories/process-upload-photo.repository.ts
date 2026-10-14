import { prisma } from '../config/prisma';
import type { ProcessPhotoKind, ProcessUploadPhoto } from '@prisma/client';

/** Insert one row. `kind` defaults to `DOCUMENT` when omitted. */
export interface CreateProcessUploadPhotoData {
  processId: string;
  category: string;
  imageName: string;
  kind?: ProcessPhotoKind;
  /** When true, mark this row as the starred (primary) vehicle photo. Defaults to false. */
  isStarred?: boolean;
}

/** Replace mutable columns on update. `kind` is immutable and never updated here. */
export interface UpdateProcessUploadPhotoData {
  category: string;
  imageName: string;
}

/**
 * Inserts a process upload photo row.
 *
 * @param data - Required FK and display fields; optional `kind` (default `DOCUMENT`).
 */
export async function createProcessUploadPhoto(
  data: CreateProcessUploadPhotoData,
): Promise<ProcessUploadPhoto> {
  return prisma.processUploadPhoto.create({
    data: {
      processId: data.processId,
      category: data.category,
      imageName: data.imageName,
      ...(data.kind ? { kind: data.kind } : {}),
      ...(data.isStarred ? { isStarred: true } : {}),
    },
  });
}

/**
 * Counts existing `VEHICLE`-kind photos on a process. Used to enforce the per-process cap.
 *
 * @param processId - Vehicle process UUID.
 */
export async function countVehiclePhotos(processId: string): Promise<number> {
  return prisma.processUploadPhoto.count({
    where: { processId, kind: 'VEHICLE' },
  });
}

/**
 * Counts starred `VEHICLE`-kind photos on a process. Used to auto-star the first vehicle photo
 * (a zero count means no primary photo exists yet).
 *
 * @param processId - Vehicle process UUID.
 */
export async function countStarredVehiclePhotos(processId: string): Promise<number> {
  return prisma.processUploadPhoto.count({
    where: { processId, kind: 'VEHICLE', isStarred: true },
  });
}

/**
 * Finds the oldest remaining `VEHICLE`-kind photo on a process, excluding one id. Used to promote a
 * new primary photo after the starred one is deleted.
 *
 * @param processId - Vehicle process UUID.
 * @param excludePhotoId - Photo id to exclude (typically the just-deleted starred photo).
 */
export async function findOldestRemainingVehiclePhoto(
  processId: string,
  excludePhotoId: string,
): Promise<ProcessUploadPhoto | null> {
  return prisma.processUploadPhoto.findFirst({
    where: { processId, kind: 'VEHICLE', NOT: { processUploadPhotoId: excludePhotoId } },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Makes `photoId` the sole starred `VEHICLE`-kind photo on a process: clears the star on every
 * vehicle photo of the process, then stars the target — atomically, preserving the one-star invariant.
 *
 * @param processId - Vehicle process UUID.
 * @param photoId - The photo to star.
 */
export async function setStarredVehiclePhoto(
  processId: string,
  photoId: string,
): Promise<ProcessUploadPhoto> {
  const [, updated] = await prisma.$transaction([
    prisma.processUploadPhoto.updateMany({
      where: { processId, kind: 'VEHICLE' },
      data: { isStarred: false },
    }),
    prisma.processUploadPhoto.update({
      where: { processUploadPhotoId: photoId },
      data: { isStarred: true },
    }),
  ]);
  return updated;
}

/**
 * Idempotently upholds the one-star invariant: if the process has ≥1 VEHICLE photo but NONE is starred,
 * stars the OLDEST one; no-op when a star already exists or there are no vehicle photos. The target is
 * DETERMINISTIC (oldest by createdAt, then id), so even two concurrent callers converge on the same
 * single row and can never create two stars — a race-safe replacement for check-then-act auto-star and
 * for promoting a replacement after the starred photo is deleted.
 *
 * @param processId - Vehicle process UUID.
 */
export async function ensureStarredVehiclePhoto(processId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const starred = await tx.processUploadPhoto.count({
      where: { processId, kind: 'VEHICLE', isStarred: true },
    });
    if (starred > 0) {
      return;
    }
    const oldest = await tx.processUploadPhoto.findFirst({
      where: { processId, kind: 'VEHICLE' },
      orderBy: [{ createdAt: 'asc' }, { processUploadPhotoId: 'asc' }],
      select: { processUploadPhotoId: true },
    });
    if (oldest) {
      await tx.processUploadPhoto.update({
        where: { processUploadPhotoId: oldest.processUploadPhotoId },
        data: { isStarred: true },
      });
    }
  });
}

/**
 * Counts rows that reference the same stored image key (any process). Used to guard a best-effort
 * file delete: only remove the underlying bytes when no other row still points at them.
 *
 * @param imageName - Stored (folder-scoped) object key.
 */
export async function countByImageName(imageName: string): Promise<number> {
  return prisma.processUploadPhoto.count({
    where: { imageName },
  });
}

/**
 * Inserts many rows in one transaction.
 *
 * @param rows - Same shape as single create (caller enforces dealer scope).
 */
export async function createManyProcessUploadPhotos(
  rows: CreateProcessUploadPhotoData[],
): Promise<ProcessUploadPhoto[]> {
  return prisma.$transaction(
    rows.map((row) =>
      prisma.processUploadPhoto.create({
        data: {
          processId: row.processId,
          category: row.category,
          imageName: row.imageName,
        },
      }),
    ),
  );
}

/**
 * Finds by primary key.
 *
 * @param processUploadPhotoId - UUID.
 */
export async function findProcessUploadPhotoById(
  processUploadPhotoId: string,
): Promise<ProcessUploadPhoto | null> {
  return prisma.processUploadPhoto.findUnique({
    where: { processUploadPhotoId },
  });
}

/**
 * Lists photos for a process, oldest first.
 *
 * @param processId - Vehicle process UUID.
 */
export async function listProcessUploadPhotosByProcessId(
  processId: string,
): Promise<ProcessUploadPhoto[]> {
  return prisma.processUploadPhoto.findMany({
    where: { processId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Updates category and image name.
 *
 * @param processUploadPhotoId - Primary key.
 * @param data - New values.
 */
export async function updateProcessUploadPhoto(
  processUploadPhotoId: string,
  data: UpdateProcessUploadPhotoData,
): Promise<ProcessUploadPhoto> {
  return prisma.processUploadPhoto.update({
    where: { processUploadPhotoId },
    data: {
      category: data.category,
      imageName: data.imageName,
    },
  });
}

/**
 * Deletes a row by id.
 *
 * @param processUploadPhotoId - Primary key.
 */
export async function deleteProcessUploadPhoto(
  processUploadPhotoId: string,
): Promise<ProcessUploadPhoto> {
  return prisma.processUploadPhoto.delete({
    where: { processUploadPhotoId },
  });
}

/**
 * Returns EVERY `imageName` object key referenced by a photo row, across all processes and regardless
 * of `deletedAt` (soft-deleted processes still own their files). Feeds the orphan-root-upload sweep's
 * referenced-key set so a still-referenced flat upload is never deleted. `imageName` is non-null in the
 * schema, so no filtering is needed.
 */
export async function findAllImageNames(): Promise<string[]> {
  const rows = await prisma.processUploadPhoto.findMany({
    select: { imageName: true },
  });
  return rows.map((row) => row.imageName);
}
