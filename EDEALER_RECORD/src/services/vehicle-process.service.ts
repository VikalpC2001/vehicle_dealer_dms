import { StatusCodes } from 'http-status-codes';
import type { Vehicle, VehicleProcess } from '@prisma/client';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import type { VehicleProcessDetailsRow } from '../repositories/vehicle-process.repository';
import * as vehicleRepository from '../repositories/vehicle.repository';
import * as dealerRepository from '../repositories/dealer.repository';
import type { CreateVehicleInput } from './vehicle.service';
import { upsertVehicleByRegistrationNumber } from './vehicle.service';
import {
  assertDealerReferencesForProcessStart,
  type StartProcessReferenceInput,
} from './process-reference.service';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';
import { resolvePhotoUrl } from '../utils/upload-url';

export interface PersonInput {
  personName: string;
  address?: string | null;
  mobileNumber: string;
  personType: 'SELLER' | 'BUYER';
}

export interface CreateVehicleProcessInput {
  vehicleId: string;
  dealerId: string;
  status: string;
  processDate: string;
  persons: PersonInput[];
  purchasePrice?: number | null;
  salePrice?: number | null;
  priceCurrency?: string | null;
}

export interface UpdateVehicleProcessInput extends CreateVehicleProcessInput {}

/** Initial workflow status for a newly started vehicle process. */
const INITIAL_VEHICLE_PROCESS_STATUS = 'Pending';

export type VehicleProcessWithPersons = vehicleProcessRepository.VehicleProcessWithPersons;
export type VehicleProcessWithStartRelations =
  vehicleProcessRepository.VehicleProcessWithStartRelations;

/** Upload photo row for start (no processId — assigned when the process is created). */
export interface StartUploadPhotoInput {
  category: string;
  imageName: string;
}

/** Vehicle fields for start endpoint plus optional process metadata and related rows. */
export type StartVehicleProcessWithVehicleInput = CreateVehicleInput & {
  processDate?: string;
  persons?: PersonInput[];
  uploadPhotos?: StartUploadPhotoInput[];
  processReferences?: StartProcessReferenceInput[];
  purchasePrice?: number | null;
  salePrice?: number | null;
  priceCurrency?: string | null;
};

/**
 * Upserts the vehicle by `registrationNumber`, then creates a dealer-scoped process with status
 * `Pending` and `processDate` defaulting to now. Optional `persons` are created in the same step;
 * omit or pass an empty array to create only the process.
 *
 * @param dealerId - Resolved from JWT (or explicit for ADMIN).
 * @param input - Vehicle snapshot, optional ISO `processDate`, optional `persons`, `uploadPhotos`, `processReferences`.
 */
export async function startVehicleProcessWithVehicle(
  dealerId: string,
  input: StartVehicleProcessWithVehicleInput,
): Promise<{
  vehicle: Vehicle;
  process: VehicleProcessWithStartRelations;
  vehicleCreated: boolean;
  vehicleUpdated: boolean;
  uploadPhotos: VehicleProcessWithStartRelations['processUploadPhotos'];
  processReferences: VehicleProcessWithStartRelations['processReferences'];
}> {
  const {
    processDate: processDateRaw,
    persons: personsInput,
    uploadPhotos: uploadPhotosInput,
    processReferences: processReferencesInput,
    purchasePrice,
    salePrice,
    priceCurrency,
    ...vehicleInput
  } = input;
  const persons = personsInput ?? [];
  const uploadPhotos = (uploadPhotosInput ?? []).map((photo) => ({
    category: photo.category.trim(),
    imageName: photo.imageName.trim(),
  }));
  const processReferences = processReferencesInput ?? [];
  const upsert = await upsertVehicleByRegistrationNumber(vehicleInput);

  const dealer = await dealerRepository.findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }

  const processDate = processDateRaw?.trim()
    ? new Date(processDateRaw)
    : new Date();
  if (Number.isNaN(processDate.getTime())) {
    throw new AppError('Invalid process date', StatusCodes.UNPROCESSABLE_ENTITY, 4227);
  }

  await assertDealerReferencesForProcessStart(dealerId, processReferences);

  const process = await vehicleProcessRepository.createVehicleProcess({
    vehicleId: upsert.vehicle.vehicleId,
    dealerId,
    status: INITIAL_VEHICLE_PROCESS_STATUS,
    processDate,
    purchasePrice: purchasePrice ?? null,
    salePrice: salePrice ?? null,
    priceCurrency: priceCurrency ?? null,
    persons: persons.map((p) => ({
      personName: p.personName,
      address: p.address ?? null,
      mobileNumber: p.mobileNumber,
      personType: p.personType,
    })),
    uploadPhotos,
    processReferences,
  });

  return {
    vehicle: upsert.vehicle,
    process,
    vehicleCreated: upsert.created,
    vehicleUpdated: upsert.updated,
    uploadPhotos: process.processUploadPhotos,
    processReferences: process.processReferences,
  };
}

export async function createVehicleProcess(
  input: CreateVehicleProcessInput,
): Promise<VehicleProcessWithPersons> {
  const vehicle = await vehicleRepository.findVehicleById(input.vehicleId);
  if (!vehicle) {
    throw new AppError('Vehicle not found', StatusCodes.NOT_FOUND, 4047);
  }

  const dealer = await dealerRepository.findDealerById(input.dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }

  return vehicleProcessRepository.createVehicleProcess({
    vehicleId: input.vehicleId,
    dealerId: input.dealerId,
    status: input.status,
    processDate: new Date(input.processDate),
    purchasePrice: input.purchasePrice ?? null,
    salePrice: input.salePrice ?? null,
    priceCurrency: input.priceCurrency ?? null,
    persons: input.persons.map((p) => ({
      personName: p.personName,
      address: p.address ?? null,
      mobileNumber: p.mobileNumber,
      personType: p.personType,
    })),
  });
}

/**
 * Lists vehicle processes, dealer-scoped when `dealerId` is provided (non-admin callers pass their
 * own dealer; super-admin passes null to see all). Fixes the prior cross-dealer leak.
 */
export async function listVehicleProcesses(
  query: PaginationQuery,
  dealerId?: string | null,
): Promise<PaginatedResult<vehicleProcessRepository.VehicleProcessListItem>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await vehicleProcessRepository.listVehicleProcesses(skip, take, dealerId);
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

export async function getVehicleProcessById(processId: string): Promise<VehicleProcessWithPersons> {
  const process = await vehicleProcessRepository.findVehicleProcessById(processId);
  if (!process) {
    throw new AppError('Vehicle process not found', StatusCodes.NOT_FOUND, 4050);
  }
  return process;
}

/** Person summary for process detail responses. */
export interface VehicleProcessPersonDetailDto {
  personId: string;
  personName: string;
  address: string | null;
  mobileNumber: string;
}

/** Linked dealer reference on a process. */
export interface VehicleProcessReferenceDetailDto {
  processReferenceId: string;
  referenceId: string;
  referenceName: string;
  referenceNumber: string;
  referenceType: 'BUY' | 'SELL';
}

/** Upload row with resolved public photo URL. */
export interface VehicleProcessPhotoDetailDto {
  processUploadPhotoId: string | null;
  processUploadImageId: string | null;
  category: string;
  imageName: string;
  photoUrl: string;
}

/** Aggregated vehicle process detail for a single read API. */
export interface VehicleProcessDetailsDto {
  processId: string;
  vehicleId: string | null;
  dealerId: string | null;
  status: string | null;
  processDate: Date | null;
  purchasePrice: number | null;
  salePrice: number | null;
  priceCurrency: string | null;
  vehicle: Vehicle | null;
  owner: VehicleProcessPersonDetailDto | null;
  buyer: VehicleProcessPersonDetailDto | null;
  references: {
    seller: VehicleProcessReferenceDetailDto | null;
    buyer: VehicleProcessReferenceDetailDto | null;
  };
  photos: VehicleProcessPhotoDetailDto[];
}

/**
 * Maps a person row to the detail DTO (excludes processId / personType / timestamps).
 *
 * @param person - Prisma person row.
 */
const toPersonDetail = (
  person: VehicleProcessDetailsRow['persons'][number],
): VehicleProcessPersonDetailDto => ({
  personId: person.personId,
  personName: person.personName,
  address: person.address,
  mobileNumber: person.mobileNumber,
});

/**
 * Maps a process reference with nested dealer reference to the detail DTO.
 *
 * @param row - Process reference with optional dealer reference.
 */
const toReferenceDetail = (
  row: VehicleProcessDetailsRow['processReferences'][number],
): VehicleProcessReferenceDetailDto | null => {
  if (!row.referenceId || !row.referenceType || !row.reference) {
    return null;
  }
  return {
    processReferenceId: row.processReferenceId,
    referenceId: row.referenceId,
    referenceName: row.reference.referenceName,
    referenceNumber: row.reference.referenceNumber,
    referenceType: row.referenceType,
  };
};

/**
 * Builds the unified photos array from upload photo and upload image tables.
 *
 * @param row - Full process detail row from the repository.
 * @param publicOrigin - Optional origin for local upload URL resolution.
 */
const toPhotoDetails = (
  row: VehicleProcessDetailsRow,
  publicOrigin?: string,
): VehicleProcessPhotoDetailDto[] => {
  const fromPhotos: VehicleProcessPhotoDetailDto[] = row.processUploadPhotos.map((photo) => ({
    processUploadPhotoId: photo.processUploadPhotoId,
    processUploadImageId: null,
    category: photo.category,
    imageName: photo.imageName,
    photoUrl: resolvePhotoUrl(photo.imageName, publicOrigin),
  }));

  const fromImages: VehicleProcessPhotoDetailDto[] = row.processUploadImages.map((image) => ({
    processUploadPhotoId: null,
    processUploadImageId: image.processUploadImageId,
    category: image.dealerWiseUploadCategory.uploadCategory.categoryName,
    imageName: image.imageName,
    photoUrl: resolvePhotoUrl(image.imageLink || image.imageName, publicOrigin),
  }));

  return [...fromPhotos, ...fromImages];
};

/**
 * Returns vehicle, owner (seller), buyer, references, and photo URLs for one process.
 *
 * @param processId - Vehicle process UUID.
 * @param publicOrigin - Optional origin used to build local upload URLs.
 */
export async function getVehicleProcessDetails(
  processId: string,
  publicOrigin?: string,
): Promise<VehicleProcessDetailsDto> {
  const row = await vehicleProcessRepository.findVehicleProcessDetailsById(processId);
  if (!row) {
    throw new AppError('Vehicle process not found', StatusCodes.NOT_FOUND, 4050);
  }

  const ownerPerson = row.persons.find((p) => p.personType === 'SELLER') ?? null;
  const buyerPerson = row.persons.find((p) => p.personType === 'BUYER') ?? null;

  const sellerRef =
    row.processReferences.find((r) => r.referenceType === 'SELL') ?? null;
  const buyerRef =
    row.processReferences.find((r) => r.referenceType === 'BUY') ?? null;

  return {
    processId: row.processId,
    vehicleId: row.vehicleId,
    dealerId: row.dealerId,
    status: row.status,
    processDate: row.processDate,
    purchasePrice: row.purchasePrice ? row.purchasePrice.toNumber() : null,
    salePrice: row.salePrice ? row.salePrice.toNumber() : null,
    priceCurrency: row.priceCurrency,
    vehicle: row.vehicle,
    owner: ownerPerson ? toPersonDetail(ownerPerson) : null,
    buyer: buyerPerson ? toPersonDetail(buyerPerson) : null,
    references: {
      seller: sellerRef ? toReferenceDetail(sellerRef) : null,
      buyer: buyerRef ? toReferenceDetail(buyerRef) : null,
    },
    photos: toPhotoDetails(row, publicOrigin),
  };
}

export async function updateVehicleProcess(
  processId: string,
  input: UpdateVehicleProcessInput,
): Promise<VehicleProcessWithPersons> {
  await getVehicleProcessById(processId);

  const vehicle = await vehicleRepository.findVehicleById(input.vehicleId);
  if (!vehicle) {
    throw new AppError('Vehicle not found', StatusCodes.NOT_FOUND, 4047);
  }

  const dealer = await dealerRepository.findDealerById(input.dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }

  return vehicleProcessRepository.updateVehicleProcess(processId, {
    vehicleId: input.vehicleId,
    dealerId: input.dealerId,
    status: input.status,
    processDate: new Date(input.processDate),
    purchasePrice: input.purchasePrice ?? null,
    salePrice: input.salePrice ?? null,
    priceCurrency: input.priceCurrency ?? null,
    persons: input.persons.map((p) => ({
      personName: p.personName,
      address: p.address ?? null,
      mobileNumber: p.mobileNumber,
      personType: p.personType,
    })),
  });
}

export async function deleteVehicleProcess(processId: string): Promise<void> {
  await getVehicleProcessById(processId);
  await vehicleProcessRepository.deleteVehicleProcess(processId);
}

// Explicit export to make it easy to reference in docs/types.
export type { VehicleProcess };

