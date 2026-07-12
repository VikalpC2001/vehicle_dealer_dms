import { StatusCodes } from 'http-status-codes';
import type { Person } from '@prisma/client';
import * as personRepository from '../repositories/person.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import { AppError } from '../utils/app-error';

export interface CreatePersonInput {
  processId: string;
  personName: string;
  address?: string | null;
  mobileNumber: string;
  personType: 'SELLER' | 'BUYER';
}

export interface UpdatePersonInput {
  personName: string;
  address?: string | null;
  mobileNumber: string;
  personType: 'SELLER' | 'BUYER';
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

/**
 * Creates a person under a vehicle process scoped to the dealer.
 *
 * @param dealerId - Resolved dealer from JWT / admin body.
 * @param input - `processId` and person fields.
 */
export async function createPerson(dealerId: string, input: CreatePersonInput): Promise<Person> {
  await assertProcessOwnedByDealer(input.processId, dealerId);
  return personRepository.createPerson({
    processId: input.processId,
    personName: input.personName,
    address: input.address ?? null,
    mobileNumber: input.mobileNumber,
    personType: input.personType,
  });
}

/**
 * Lists all persons for a vehicle process (dealer-scoped).
 *
 * @param dealerId - Resolved dealer from JWT / admin query.
 * @param processId - Vehicle process UUID.
 */
export async function listPersonsByProcess(dealerId: string, processId: string): Promise<Person[]> {
  await assertProcessOwnedByDealer(processId, dealerId);
  return personRepository.listPersonsByProcessId(processId);
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
  await getPersonForDealerOrThrow(personId, dealerId);
  return personRepository.updatePerson(personId, {
    personName: input.personName,
    address: input.address ?? null,
    mobileNumber: input.mobileNumber,
    personType: input.personType,
  });
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
