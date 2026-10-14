import { StatusCodes } from 'http-status-codes';
import type { ProcessPhotoKind, ProcessUploadPhoto } from '@prisma/client';
import * as processUploadPhotoRepository from '../repositories/process-upload-photo.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import { uploadService } from './upload.service';
import { AppError } from '../utils/app-error';

/** Maximum number of `VEHICLE`-kind photos allowed per process. */
const MAX_VEHICLE_PHOTOS = 5;

export interface CreateProcessUploadPhotoInput {
  processId: string;
  category: string;
  imageName: string;
  kind?: ProcessPhotoKind;
}

export interface UpdateProcessUploadPhotoInput {
  category: string;
  imageName: string;
}

/**
 * Ensures the vehicle process exists and is owned by `dealerId`.
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
 * Loads the photo and ensures its parent process belongs to `dealerId`.
 */
const getPhotoForDealerOrThrow = async (
  processUploadPhotoId: string,
  dealerId: string,
): Promise<ProcessUploadPhoto> => {
  const row = await processUploadPhotoRepository.findProcessUploadPhotoById(processUploadPhotoId);
  if (!row) {
    throw new AppError('Process upload photo not found', StatusCodes.NOT_FOUND, 4056);
  }
  await assertProcessOwnedByDealer(row.processId, dealerId);
  return row;
};

/**
 * Creates one upload photo record for a dealer-scoped process.
 *
 * @param dealerId - Resolved from JWT / admin override.
 * @param input - `processId`, `category`, `imageName`.
 */
export async function createProcessUploadPhoto(
  dealerId: string,
  input: CreateProcessUploadPhotoInput,
): Promise<ProcessUploadPhoto> {
  await assertProcessOwnedByDealer(input.processId, dealerId);
  const kind: ProcessPhotoKind = input.kind ?? 'DOCUMENT';
  // A vehicle can have at most 5 photos; count before relocating any bytes so we fail fast.
  if (kind === 'VEHICLE') {
    const existing = await processUploadPhotoRepository.countVehiclePhotos(input.processId);
    if (existing >= MAX_VEHICLE_PHOTOS) {
      throw new AppError(
        'A vehicle can have at most 5 photos.',
        StatusCodes.CONFLICT,
        4114,
      );
    }
  }
  // Relocate the flat-uploaded file into this process's folder so all its documents stay together.
  const registrationNumber = await vehicleProcessRepository.findVehicleRegistrationForProcess(
    input.processId,
  );
  const originalKey = input.imageName.trim();
  const imageName = await uploadService.relocateToProcessFolder(
    originalKey,
    registrationNumber,
    input.processId,
  );
  let created: ProcessUploadPhoto;
  try {
    created = await processUploadPhotoRepository.createProcessUploadPhoto({
      processId: input.processId,
      category: input.category.trim(),
      imageName,
      kind,
    });
  } catch (err) {
    // Roll the move back so the flat file stays valid for a retry when the write failed — but ONLY if
    // no committed row references the folder key. Two photos can legitimately share one uploaded key;
    // if a sibling already moved the shared bytes there, relocate resolved without moving and moving
    // it back would orphan that sibling's file.
    if (imageName !== originalKey) {
      const stillReferenced = await processUploadPhotoRepository.countByImageName(imageName);
      if (stillReferenced === 0) {
        await uploadService.tryMove(imageName, originalKey);
      }
    }
    throw err;
  }
  // The first vehicle photo becomes the primary (starred). Done AFTER the insert via an idempotent,
  // race-safe reconcile that stars the OLDEST vehicle photo when none is starred — so two concurrent
  // first-photo uploads converge on the same single row instead of both self-starring.
  if (kind === 'VEHICLE') {
    await processUploadPhotoRepository.ensureStarredVehiclePhoto(input.processId);
  }
  return created;
}

/**
 * Creates multiple upload photo rows; each item’s `processId` is verified for the same dealer.
 *
 * @param dealerId - Resolved dealer scope.
 * @param items - Non-empty list of `{ processId, category, imageName }`.
 */
export async function createManyProcessUploadPhotos(
  dealerId: string,
  items: CreateProcessUploadPhotoInput[],
): Promise<ProcessUploadPhoto[]> {
  const normalized = items.map((i) => ({
    processId: i.processId,
    category: i.category.trim(),
    imageName: i.imageName.trim(),
  }));
  for (const row of normalized) {
    await assertProcessOwnedByDealer(row.processId, dealerId);
  }
  // Relocate each flat-uploaded file into its process's folder (registration cached per process).
  // The whole relocate-then-write span is guarded: any throw (a per-process registration lookup or
  // the DB write) rolls back every move done so far, so no bytes are stranded and a retry succeeds.
  const registrationByProcess = new Map<string, string | null>();
  const relocated: Array<{
    processId: string;
    category: string;
    imageName: string;
    originalKey: string;
  }> = [];
  try {
    for (const row of normalized) {
      if (!registrationByProcess.has(row.processId)) {
        registrationByProcess.set(
          row.processId,
          await vehicleProcessRepository.findVehicleRegistrationForProcess(row.processId),
        );
      }
      const imageName = await uploadService.relocateToProcessFolder(
        row.imageName,
        registrationByProcess.get(row.processId) ?? null,
        row.processId,
      );
      relocated.push({ ...row, imageName, originalKey: row.imageName });
    }
    return await processUploadPhotoRepository.createManyProcessUploadPhotos(
      relocated.map(({ processId, category, imageName }) => ({ processId, category, imageName })),
    );
  } catch (err) {
    // Roll every successful move back to its flat key so a retry finds the uploaded bytes.
    await Promise.all(
      relocated
        .filter((r) => r.imageName !== r.originalKey)
        .map((r) => uploadService.tryMove(r.imageName, r.originalKey)),
    );
    throw err;
  }
}

/**
 * Lists upload photos for a process (dealer-scoped).
 */
export async function listProcessUploadPhotosByProcess(
  dealerId: string,
  processId: string,
): Promise<ProcessUploadPhoto[]> {
  await assertProcessOwnedByDealer(processId, dealerId);
  return processUploadPhotoRepository.listProcessUploadPhotosByProcessId(processId);
}

/**
 * Returns a single row if the parent process belongs to the dealer.
 */
export async function getProcessUploadPhotoById(
  dealerId: string,
  processUploadPhotoId: string,
): Promise<ProcessUploadPhoto> {
  return getPhotoForDealerOrThrow(processUploadPhotoId, dealerId);
}

/**
 * Stars a vehicle photo (dealer-scoped) as the process's sole primary/profile photo. Clearing the
 * star on every other vehicle photo happens atomically in the repository, preserving the one-star
 * invariant. Only `VEHICLE`-kind photos can be starred.
 *
 * @param dealerId - Resolved dealer scope.
 * @param processUploadPhotoId - The photo to star.
 */
export async function setStarredVehiclePhoto(
  dealerId: string,
  processUploadPhotoId: string,
): Promise<ProcessUploadPhoto> {
  const row = await getPhotoForDealerOrThrow(processUploadPhotoId, dealerId);
  if (row.kind !== 'VEHICLE') {
    throw new AppError('Only vehicle photos can be starred', StatusCodes.CONFLICT, 4115);
  }
  return processUploadPhotoRepository.setStarredVehiclePhoto(row.processId, processUploadPhotoId);
}

/**
 * Updates a photo (dealer-scoped). Always allows a `category` change. When `imageName` is a NEW
 * flat upload key (different from the stored one) the file is relocated into the process folder and
 * the OLD image bytes are best-effort removed after the row is updated. `kind` is immutable. An
 * unchanged/absent `imageName` keeps the category-only behaviour.
 */
export async function updateProcessUploadPhoto(
  dealerId: string,
  processUploadPhotoId: string,
  input: UpdateProcessUploadPhotoInput,
): Promise<ProcessUploadPhoto> {
  const existing = await getPhotoForDealerOrThrow(processUploadPhotoId, dealerId);
  const category = input.category.trim();
  const suppliedKey = input.imageName.trim();

  // Category-only update: the supplied image key already matches the stored one.
  if (suppliedKey === existing.imageName) {
    return processUploadPhotoRepository.updateProcessUploadPhoto(processUploadPhotoId, {
      category,
      imageName: existing.imageName,
    });
  }

  // A new image was uploaded — relocate it into the process folder (same helper as create).
  const registrationNumber = await vehicleProcessRepository.findVehicleRegistrationForProcess(
    existing.processId,
  );
  const newImageName = await uploadService.relocateToProcessFolder(
    suppliedKey,
    registrationNumber,
    existing.processId,
  );
  let updated: ProcessUploadPhoto;
  try {
    updated = await processUploadPhotoRepository.updateProcessUploadPhoto(processUploadPhotoId, {
      category,
      imageName: newImageName,
    });
  } catch (err) {
    // Roll the move back for a retry — but only if no committed row references the folder key (a
    // sibling may share these bytes; moving them back would orphan it).
    if (newImageName !== suppliedKey) {
      const stillReferenced = await processUploadPhotoRepository.countByImageName(newImageName);
      if (stillReferenced === 0) {
        await uploadService.tryMove(newImageName, suppliedKey);
      }
    }
    throw err;
  }
  // Remove the old bytes unless another row still references the same key. Best-effort; never throws.
  if (existing.imageName !== newImageName) {
    const stillReferenced = await processUploadPhotoRepository.countByImageName(existing.imageName);
    if (stillReferenced === 0) {
      await uploadService.deleteFile(existing.imageName);
    }
  }
  return updated;
}

/**
 * Deletes a row (dealer-scoped) and best-effort removes its underlying file, unless another row
 * still references the same image key.
 */
export async function deleteProcessUploadPhoto(
  dealerId: string,
  processUploadPhotoId: string,
): Promise<void> {
  const existing = await getPhotoForDealerOrThrow(processUploadPhotoId, dealerId);
  await processUploadPhotoRepository.deleteProcessUploadPhoto(processUploadPhotoId);
  // Deleting the starred (primary) vehicle photo promotes the oldest remaining one so the process keeps
  // exactly one starred photo whenever any vehicle photo remains. Idempotent + self-healing: if this
  // reconcile fails transiently after the delete commits, the next create/delete/star fixes it.
  if (existing.kind === 'VEHICLE' && existing.isStarred) {
    await processUploadPhotoRepository.ensureStarredVehiclePhoto(existing.processId);
  }
  const stillReferenced = await processUploadPhotoRepository.countByImageName(existing.imageName);
  if (stillReferenced === 0) {
    await uploadService.deleteFile(existing.imageName);
  }
}
