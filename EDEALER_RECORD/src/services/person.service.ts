import { StatusCodes } from 'http-status-codes';
import type { Person } from '@prisma/client';
import * as personRepository from '../repositories/person.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import { uploadService } from './upload.service';
import { resolvePhotoUrl } from '../utils/upload-url';
import { assertSafeFileKey } from '../utils/file.utils';
import { AppError } from '../utils/app-error';

export interface CreatePersonInput {
  processId: string;
  personName: string;
  address?: string | null;
  mobileNumber: string;
  personType: 'SELLER' | 'BUYER';
  /** Optional flat upload key of the person's ID photo, stored + linked to them on create. */
  idImageName?: string | null;
}

export interface UpdatePersonInput {
  personName: string;
  address?: string | null;
  mobileNumber: string;
  personType: 'SELLER' | 'BUYER';
  /** Optional flat upload key of a new ID photo — replaces the person's linked ID on update. */
  idImageName?: string | null;
}

/** New buyer fields + optional flat upload key of their ID photo, for the change-buyer flow. */
export interface ChangeBuyerInput {
  personName: string;
  address?: string | null;
  mobileNumber: string;
  buyerIdImageName?: string | null;
}

/** A buyer's ID-proof photo with a resolved URL. */
export interface PersonPhotoDto {
  processUploadPhotoId: string;
  category: string;
  imageName: string;
  photoUrl: string;
}

/** A person (buyer/seller) with status + linked ID photos, for the persons list. */
export interface PersonDetailDto {
  personId: string;
  personName: string;
  address: string | null;
  mobileNumber: string;
  personType: 'SELLER' | 'BUYER';
  status: 'ACTIVE' | 'CANCELLED';
  idPhotos: PersonPhotoDto[];
}

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
 * Loads the person and ensures its process belongs to `dealerId`.
 */
const getPersonForDealerOrThrow = async (
  personId: string,
  dealerId: string,
): Promise<Person> => {
  const person = await personRepository.findPersonById(personId);
  if (!person) {
    throw new AppError('Person not found', StatusCodes.NOT_FOUND, 4055);
  }
  await assertProcessOwnedByDealer(person.processId, dealerId);
  return person;
};

/** Category for a person's linked ID photo, by type. Matches change-buyer's 'Buyer ID' write. */
const idCategoryFor = (personType: 'SELLER' | 'BUYER'): string =>
  personType === 'BUYER' ? 'Buyer ID' : 'Seller ID';

/**
 * Relocates a flat ID-upload key into the process's folder (validating it first), so the ID photo
 * lives alongside the process's other documents. Returns the folder-scoped key, or null when no ID
 * was provided. Mirrors the change-buyer relocation.
 */
async function relocateIdPhoto(processId: string, idImageName: string | null): Promise<string | null> {
  if (!idImageName) return null;
  // Reject foldered/foreign/traversal keys before relocate (4008).
  assertSafeFileKey(idImageName);
  const registrationNumber =
    await vehicleProcessRepository.findVehicleRegistrationForProcess(processId);
  return uploadService.relocateToProcessFolder(idImageName, registrationNumber, processId);
}

/**
 * Creates a person under a vehicle process scoped to the dealer, optionally storing their ID photo
 * (linked to them, so it shows in the Documents grid while they're active).
 *
 * @param dealerId - Resolved dealer from JWT / admin body.
 * @param input - `processId`, person fields, and an optional flat ID-photo upload key.
 */
export async function createPerson(dealerId: string, input: CreatePersonInput): Promise<Person> {
  await assertProcessOwnedByDealer(input.processId, dealerId);

  const originalKey = input.idImageName?.trim() || null;
  const relocatedKey = await relocateIdPhoto(input.processId, originalKey);
  const idCategory = idCategoryFor(input.personType);

  try {
    // Only one ACTIVE buyer per process — replacing one goes through "change buyer" (cancel + add).
    // The check-and-insert is done atomically (advisory lock) to avoid a TOCTOU where two concurrent
    // requests both pass the check and insert a second ACTIVE buyer.
    if (input.personType === 'BUYER') {
      const buyer = await personRepository.createBuyerIfNoneTx({
        processId: input.processId,
        personName: input.personName,
        address: input.address ?? null,
        mobileNumber: input.mobileNumber,
        personType: input.personType,
        idImageName: relocatedKey,
        idCategory,
      });
      if (!buyer) {
        throw new AppError(
          'This process already has an active buyer. Use "Change buyer" to replace them.',
          StatusCodes.UNPROCESSABLE_ENTITY,
          4064,
        );
      }
      return buyer;
    }
    return await personRepository.createPerson({
      processId: input.processId,
      personName: input.personName,
      address: input.address ?? null,
      mobileNumber: input.mobileNumber,
      personType: input.personType,
      idImageName: relocatedKey,
      idCategory,
    });
  } catch (err) {
    // Roll the ID-photo move back to its flat key so a retry finds the bytes if the write failed.
    if (relocatedKey && originalKey && relocatedKey !== originalKey) {
      await uploadService.tryMove(relocatedKey, originalKey);
    }
    throw err;
  }
}

/**
 * Replaces the process's active buyer: cancels the current buyer (kept for history with their ID
 * photo) and creates a new ACTIVE buyer, optionally attaching a new ID photo linked to them. Atomic.
 *
 * @param dealerId - Resolved dealer scope.
 * @param processId - Vehicle process UUID.
 * @param input - New buyer fields + optional flat upload key of the new buyer's ID photo.
 */
export async function changeBuyer(
  dealerId: string,
  processId: string,
  input: ChangeBuyerInput,
): Promise<Person> {
  await assertProcessOwnedByDealer(processId, dealerId);

  const originalKey = input.buyerIdImageName?.trim() || null;
  let relocatedKey: string | null = null;
  if (originalKey) {
    // Reject foldered/foreign/traversal keys before relocate — a key with a '/' would otherwise be
    // treated as already-scoped and stored verbatim (could reference another process's file). 4008.
    assertSafeFileKey(originalKey);
    const registrationNumber =
      await vehicleProcessRepository.findVehicleRegistrationForProcess(processId);
    relocatedKey = await uploadService.relocateToProcessFolder(originalKey, registrationNumber, processId);
  }

  try {
    return await personRepository.changeBuyerTx({
      processId,
      newBuyer: {
        personName: input.personName,
        address: input.address ?? null,
        mobileNumber: input.mobileNumber,
      },
      buyerIdImageName: relocatedKey,
    });
  } catch (err) {
    // Roll the ID-photo move back to its flat key so a retry finds the bytes if the write failed.
    if (relocatedKey && originalKey && relocatedKey !== originalKey) {
      await uploadService.tryMove(relocatedKey, originalKey);
    }
    throw err;
  }
}

/**
 * Lists all persons for a vehicle process (dealer-scoped).
 *
 * @param dealerId - Resolved dealer from JWT / admin query.
 * @param processId - Vehicle process UUID.
 */
export async function listPersonsByProcess(
  dealerId: string,
  processId: string,
  publicOrigin?: string,
): Promise<PersonDetailDto[]> {
  await assertProcessOwnedByDealer(processId, dealerId);
  const persons = await personRepository.listPersonsByProcessId(processId);
  return persons.map((p) => ({
    personId: p.personId,
    personName: p.personName,
    address: p.address,
    mobileNumber: p.mobileNumber,
    personType: p.personType,
    status: p.status,
    idPhotos: p.uploadPhotos.map((ph) => ({
      processUploadPhotoId: ph.processUploadPhotoId,
      category: ph.category,
      imageName: ph.imageName,
      photoUrl: resolvePhotoUrl(ph.imageName, publicOrigin),
    })),
  }));
}

/**
 * Returns a single person if its process belongs to the dealer.
 *
 * @param dealerId - Resolved dealer scope.
 * @param personId - Person UUID.
 */
export async function getPersonById(dealerId: string, personId: string): Promise<Person> {
  return getPersonForDealerOrThrow(personId, dealerId);
}

/**
 * Updates a person (dealer-scoped via parent process).
 *
 * @param dealerId - Resolved dealer scope.
 * @param personId - Person UUID.
 * @param input - Replacement field values.
 */
export async function updatePerson(
  dealerId: string,
  personId: string,
  input: UpdatePersonInput,
): Promise<Person> {
  const person = await getPersonForDealerOrThrow(personId, dealerId);

  const originalKey = input.idImageName?.trim() || null;
  // No new ID photo → plain scalar update (leaves any existing linked ID untouched).
  if (!originalKey) {
    return personRepository.updatePerson(personId, {
      personName: input.personName,
      address: input.address ?? null,
      mobileNumber: input.mobileNumber,
      personType: input.personType,
    });
  }

  const relocatedKey = await relocateIdPhoto(person.processId, originalKey);
  try {
    return await personRepository.updatePersonWithIdPhoto(personId, {
      personName: input.personName,
      address: input.address ?? null,
      mobileNumber: input.mobileNumber,
      personType: input.personType,
      processId: person.processId,
      idImageName: relocatedKey as string,
      idCategory: idCategoryFor(input.personType),
    });
  } catch (err) {
    if (relocatedKey && relocatedKey !== originalKey) {
      await uploadService.tryMove(relocatedKey, originalKey);
    }
    throw err;
  }
}

/**
 * Deletes a person (dealer-scoped via parent process).
 *
 * @param dealerId - Resolved dealer scope.
 * @param personId - Person UUID.
 */
export async function deletePerson(dealerId: string, personId: string): Promise<void> {
  await getPersonForDealerOrThrow(personId, dealerId);
  await personRepository.deletePerson(personId);
}
