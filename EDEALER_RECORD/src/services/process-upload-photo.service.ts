import { StatusCodes } from 'http-status-codes';
import type { ProcessUploadPhoto } from '@prisma/client';
import * as processUploadPhotoRepository from '../repositories/process-upload-photo.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import { uploadService } from './upload.service';
import { AppError } from '../utils/app-error';

export interface CreateProcessUploadPhotoInput {
  processId: string;
  category: string;
  imageName: string;
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
  try {
    return await processUploadPhotoRepository.createProcessUploadPhoto({
      processId: input.processId,
      category: input.category.trim(),
      imageName,
    });
  } catch (err) {
    // Roll the move back so the flat file stays valid for a retry when the write failed.
    if (imageName !== originalKey) {
      await uploadService.tryMove(imageName, originalKey);
    }
    throw err;
  }
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
 * Updates `category` and `imageName` (dealer-scoped).
 */
export async function updateProcessUploadPhoto(
  dealerId: string,
  processUploadPhotoId: string,
  input: UpdateProcessUploadPhotoInput,
): Promise<ProcessUploadPhoto> {
  await getPhotoForDealerOrThrow(processUploadPhotoId, dealerId);
  return processUploadPhotoRepository.updateProcessUploadPhoto(processUploadPhotoId, {
    category: input.category.trim(),
    imageName: input.imageName.trim(),
  });
}

/**
 * Deletes a row (dealer-scoped).
 */
export async function deleteProcessUploadPhoto(
  dealerId: string,
  processUploadPhotoId: string,
): Promise<void> {
  await getPhotoForDealerOrThrow(processUploadPhotoId, dealerId);
  await processUploadPhotoRepository.deleteProcessUploadPhoto(processUploadPhotoId);
}
