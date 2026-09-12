import { prisma } from '../config/prisma';
import type { Person, PersonType, Prisma, ProcessUploadPhoto } from '@prisma/client';

/** Fields required to insert a person row. */
export interface CreatePersonData {
  processId: string;
  personName: string;
  address: string | null;
  mobileNumber: string;
  personType: PersonType;
  /** Folder-scoped storage key of the person's ID photo (relocated by the service), or null. */
  idImageName?: string | null;
  /** Category for the linked ID photo (e.g. 'Buyer ID' / 'Seller ID'). */
  idCategory?: string;
}

/** Full replace for update (all mutable scalars). */
export interface UpdatePersonData {
  personName: string;
  address: string | null;
  mobileNumber: string;
  personType: PersonType;
}

/** Update scalars AND replace the person's linked ID photo with a new one. */
export interface UpdatePersonWithIdPhotoData extends UpdatePersonData {
  processId: string;
  /** Folder-scoped storage key of the new ID photo (relocated by the service). */
  idImageName: string;
  idCategory: string;
}

/** A person with their linked upload photos (a buyer's ID-proof docs). */
export type PersonWithPhotos = Person & { uploadPhotos: ProcessUploadPhoto[] };

/**
 * Inserts a person linked to `processId`. New persons default to `ACTIVE`.
 *
 * @param data - Row data including FK `processId`.
 */
export async function createPerson(data: CreatePersonData): Promise<Person> {
  if (!data.idImageName) {
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
  // Create the person AND their linked ID photo atomically.
  return prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        processId: data.processId,
        personName: data.personName,
        address: data.address,
        mobileNumber: data.mobileNumber,
        personType: data.personType,
      },
    });
    await tx.processUploadPhoto.create({
      data: {
        processId: data.processId,
        category: data.idCategory ?? 'ID',
        imageName: data.idImageName as string,
        personId: person.personId,
      },
    });
    return person;
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
 * Matches a category naming the BUYER's ID-proof document. Mirrors the frontend's `isBuyerIdCategory`
 * (`/\bbuyer\b/i`) so the three touch-points agree — the retention link below, the change-buyer write
 * category ('Buyer ID'), and the client's OCR routing. A plain `contains 'buyer'` diverged from this
 * (e.g. it matched 'Buyers ID' which the word-boundary rule does not).
 */
const BUYER_ID_CATEGORY = /\bbuyer\b/i;

/**
 * Serializes all buyer mutations for one process by taking a transaction-scoped PostgreSQL advisory
 * lock keyed on the process id. Without it, the check-then-insert in `changeBuyerTx` /
 * `createBuyerIfNoneTx` is a TOCTOU under Read Committed: two concurrent calls (double-click, retry,
 * two users) can each see "no/other active buyer" and both insert an ACTIVE buyer. The lock is held
 * until the enclosing transaction commits/rolls back.
 *
 * @param tx - The active transaction client.
 * @param processId - Vehicle process UUID to serialize buyer writes on.
 */
async function lockProcessForBuyerWrite(
  tx: Prisma.TransactionClient,
  processId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('buyer-write'), hashtext(${processId}))`;
}

/**
 * Creates a BUYER only if the process has no ACTIVE buyer, atomically. Returns the new buyer, or
 * `null` when an ACTIVE buyer already exists (the caller maps that to a 4064 conflict). Race-safe via
 * the per-process advisory lock — replaces the previous check-then-insert TOCTOU in the service.
 *
 * @param data - Buyer row data (personType is forced to BUYER by the caller).
 */
export async function createBuyerIfNoneTx(data: CreatePersonData): Promise<Person | null> {
  return prisma.$transaction(async (tx) => {
    await lockProcessForBuyerWrite(tx, data.processId);
    const existing = await tx.person.findFirst({
      where: { processId: data.processId, personType: 'BUYER', status: 'ACTIVE' },
    });
    if (existing) {
      return null;
    }
    const buyer = await tx.person.create({
      data: {
        processId: data.processId,
        personName: data.personName,
        address: data.address,
        mobileNumber: data.mobileNumber,
        personType: data.personType,
      },
    });
    if (data.idImageName) {
      await tx.processUploadPhoto.create({
        data: {
          processId: data.processId,
          category: data.idCategory ?? 'Buyer ID',
          imageName: data.idImageName,
          personId: buyer.personId,
        },
      });
    }
    return buyer;
  });
}

/**
 * Lists persons for a vehicle process (oldest first), each with their linked upload photos
 * (a buyer's ID-proof docs), so the UI can show the active buyer + cancelled buyers with their IDs.
 *
 * @param processId - Vehicle process UUID.
 */
export async function listPersonsByProcessId(processId: string): Promise<PersonWithPhotos[]> {
  return prisma.person.findMany({
    where: { processId },
    orderBy: { createdAt: 'asc' },
    include: { uploadPhotos: { orderBy: { createdAt: 'asc' } } },
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
 * Updates a person's scalars AND replaces their linked ID photo: deletes the person's currently
 * linked ID photos and inserts the new one — all atomically. Used when an ID image is (re)uploaded
 * while adding/editing the person, so the current ID shows in the Documents grid (active person).
 *
 * @param personId - Primary key.
 * @param data - Replacement scalars + the new (relocated) ID photo key & category.
 */
export async function updatePersonWithIdPhoto(
  personId: string,
  data: UpdatePersonWithIdPhotoData,
): Promise<Person> {
  return prisma.$transaction(async (tx) => {
    const person = await tx.person.update({
      where: { personId },
      data: {
        personName: data.personName,
        address: data.address,
        mobileNumber: data.mobileNumber,
        personType: data.personType,
      },
    });
    // Replace this person's linked ID photo(s) with the new upload.
    await tx.processUploadPhoto.deleteMany({ where: { personId } });
    await tx.processUploadPhoto.create({
      data: {
        processId: data.processId,
        category: data.idCategory,
        imageName: data.idImageName,
        personId,
      },
    });
    return person;
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

/** Data for the atomic "change buyer" operation. */
export interface ChangeBuyerData {
  processId: string;
  newBuyer: { personName: string; address: string | null; mobileNumber: string };
  /** Folder-scoped storage key of the new buyer's ID photo (relocated by the service), or null. */
  buyerIdImageName?: string | null;
}

/**
 * Atomically replaces the process's active buyer: retains the current buyer's ID photos under them
 * (linking any unlinked buyer-ID docs), CANCELs the current active buyer(s), creates the new ACTIVE
 * buyer, and (optionally) attaches the new buyer's ID photo linked to that buyer. Returns the new
 * buyer. When there is no active buyer, it simply creates the new buyer (no cancellation).
 *
 * @param data - Process id, new buyer fields, and optional new buyer-ID photo key.
 */
export async function changeBuyerTx(data: ChangeBuyerData): Promise<Person> {
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent buyer writes on this process (see lockProcessForBuyerWrite).
    await lockProcessForBuyerWrite(tx, data.processId);

    const activeBuyer = await tx.person.findFirst({
      where: { processId: data.processId, personType: 'BUYER', status: 'ACTIVE' },
    });

    if (activeBuyer) {
      // Retain the outgoing buyer's ID: link the process's still-unlinked buyer-ID docs to them.
      // Match the buyer-ID category with the same word-boundary rule the frontend uses
      // (BUYER_ID_CATEGORY) — a Prisma `contains 'buyer'` over-matches (e.g. 'Buyers ID').
      const unlinked = await tx.processUploadPhoto.findMany({
        where: { processId: data.processId, personId: null },
        select: { processUploadPhotoId: true, category: true },
      });
      const buyerIdPhotoIds = unlinked
        .filter((photo) => BUYER_ID_CATEGORY.test(photo.category))
        .map((photo) => photo.processUploadPhotoId);
      if (buyerIdPhotoIds.length > 0) {
        await tx.processUploadPhoto.updateMany({
          where: { processUploadPhotoId: { in: buyerIdPhotoIds } },
          data: { personId: activeBuyer.personId },
        });
      }
      // Cancel every active buyer (defensive: normally exactly one).
      await tx.person.updateMany({
        where: { processId: data.processId, personType: 'BUYER', status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });
    }

    const buyer = await tx.person.create({
      data: {
        processId: data.processId,
        personName: data.newBuyer.personName,
        address: data.newBuyer.address,
        mobileNumber: data.newBuyer.mobileNumber,
        personType: 'BUYER',
        status: 'ACTIVE',
      },
    });

    if (data.buyerIdImageName) {
      await tx.processUploadPhoto.create({
        data: {
          processId: data.processId,
          category: 'Buyer ID',
          imageName: data.buyerIdImageName,
          personId: buyer.personId,
        },
      });
    }

    return buyer;
  });
}
