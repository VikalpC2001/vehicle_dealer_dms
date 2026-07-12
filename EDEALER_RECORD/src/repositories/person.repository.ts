import { prisma } from '../config/prisma';
import type { Person, PersonType } from '@prisma/client';

/** Fields required to insert a person row. */
export interface CreatePersonData {
  processId: string;
  personName: string;
  address: string | null;
  mobileNumber: string;
  personType: PersonType;
}

/** Full replace for update (all mutable scalars). */
export interface UpdatePersonData {
  personName: string;
  address: string | null;
  mobileNumber: string;
  personType: PersonType;
}

/**
 * Inserts a person linked to `processId`.
 *
 * @param data - Row data including FK `processId`.
 */
export async function createPerson(data: CreatePersonData): Promise<Person> {
  return prisma.person.create({
    data: {
      processId: data.processId,
      personName: data.personName,
      address: data.address,
      mobileNumber: data.mobileNumber,
      personType: data.personType,
    },
  });
}

/**
 * Loads a person by primary key.
 *
 * @param personId - `person_id` UUID.
 */
export async function findPersonById(personId: string): Promise<Person | null> {
  return prisma.person.findUnique({
    where: { personId },
  });
}

/**
 * Lists persons for a vehicle process, oldest first.
 *
 * @param processId - Vehicle process UUID.
 */
export async function listPersonsByProcessId(processId: string): Promise<Person[]> {
  return prisma.person.findMany({
    where: { processId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Updates mutable person fields.
 *
 * @param personId - Primary key.
 * @param data - Replacement field values.
 */
export async function updatePerson(personId: string, data: UpdatePersonData): Promise<Person> {
  return prisma.person.update({
    where: { personId },
    data: {
      personName: data.personName,
      address: data.address,
      mobileNumber: data.mobileNumber,
      personType: data.personType,
    },
  });
}

/**
 * Deletes a person row.
 *
 * @param personId - Primary key.
 */
export async function deletePerson(personId: string): Promise<Person> {
  return prisma.person.delete({
    where: { personId },
  });
}
