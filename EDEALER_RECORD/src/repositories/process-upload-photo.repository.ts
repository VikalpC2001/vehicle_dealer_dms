import { prisma } from '../config/prisma';
import type { ProcessUploadPhoto } from '@prisma/client';

/** Insert one row. */
export interface CreateProcessUploadPhotoData {
  processId: string;
  category: string;
  imageName: string;
}

/** Replace mutable columns on update. */
export interface UpdateProcessUploadPhotoData {
  category: string;
  imageName: string;
}

/**
 * Inserts a process upload photo row.
 *
 * @param data - Required FK and display fields.
 */
export async function createProcessUploadPhoto(
  data: CreateProcessUploadPhotoData,
): Promise<ProcessUploadPhoto> {
  return prisma.processUploadPhoto.create({
    data: {
      processId: data.processId,
      category: data.category,
      imageName: data.imageName,
    },
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
