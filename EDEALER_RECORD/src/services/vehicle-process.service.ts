import { StatusCodes } from 'http-status-codes';
import type {
  ProcessPhotoKind,
  Vehicle,
  VehicleProcess,
  VehicleProcessStatus,
} from '@prisma/client';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import type {
  VehicleProcessDetailsRow,
  AgentBoardProcessRow,
  VehicleProcessStatusFilter,
} from '../repositories/vehicle-process.repository';
import * as processTagRepository from '../repositories/process-tag.repository';
import type { ProcessTagDto } from '../repositories/process-tag.repository';
import * as dealerTagRepository from '../repositories/dealer-tag.repository';
import { randomUUID } from 'node:crypto';
import * as vehicleRepository from '../repositories/vehicle.repository';
import * as dealerRepository from '../repositories/dealer.repository';
import * as agentStatusRepository from '../repositories/agent-status.repository';
import * as processUploadPhotoRepository from '../repositories/process-upload-photo.repository';
import * as processUploadImageRepository from '../repositories/process-upload-image.repository';
import { uploadService } from './upload.service';
import type { CreateVehicleInput } from './vehicle.service';
import { upsertVehicleByRegistrationNumber } from './vehicle.service';
import {
  assertDealerReferencesForProcessStart,
  type StartProcessReferenceInput,
} from './process-reference.service';
import { AppError } from '../utils/app-error';
import { logUnknownError } from '../utils/logger';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';
import { resolvePhotoUrl } from '../utils/upload-url';
import { buildProcessFolderPrefix, isGeneratedFileKey } from '../utils/file.utils';
import { config } from '../config';

export interface PersonInput {
  personName: string;
  address?: string | null;
  mobileNumber: string;
  personType: 'SELLER' | 'BUYER';
}

export interface CreateVehicleProcessInput {
  vehicleId: string;
  dealerId: string;
  processDate: string;
  persons: PersonInput[];
  purchasePrice?: number | null;
  salePrice?: number | null;
  priceCurrency?: string | null;
}

/** Update input. `persons` is optional: omit it to update process fields only (persons untouched). */
export interface UpdateVehicleProcessInput extends Omit<CreateVehicleProcessInput, 'persons'> {
  persons?: PersonInput[];
}

/**
 * Resolves the initial agent-kanban column for a new process. For a process created on a placeholder
 * dealer the agent owns (agent-created work), this is that agent's lowest-ranked status so the card
 * lands in the agent board's first column. Dealer-owned processes have no agent board → `null`.
 *
 * @param dealer - The dealer the process is being created on.
 */
async function resolveInitialAgentStatusId(dealer: {
  isPlaceholder: boolean;
  ownerAgentId: string | null;
}): Promise<string | null> {
  if (!dealer.isPlaceholder || !dealer.ownerAgentId) {
    return null;
  }
  const firstStatus = await agentStatusRepository.findFirstAgentStatusForAgent(dealer.ownerAgentId);
  return firstStatus?.statusId ?? null;
}

/**
 * Enforces the "at most one OPEN (status-less) process per vehicle per dealer" invariant. Throws the
 * shared conflict when an open process already exists for `(dealerId, vehicleId)`, optionally
 * ignoring `excludeProcessId` (used when clearing a process's status back to open).
 *
 * @param dealerId - The owning dealer.
 * @param vehicleId - The vehicle being processed.
 * @param excludeProcessId - The process to exclude from the check (e.g. the one being reopened).
 * @throws AppError 409/4113 when another open process exists for the vehicle under this dealer.
 */
async function assertNoOpenProcessForVehicle(
  dealerId: string,
  vehicleId: string,
  excludeProcessId?: string,
): Promise<void> {
  const open = await vehicleProcessRepository.findOpenProcessForVehicle(
    dealerId,
    vehicleId,
    excludeProcessId,
  );
  if (open) {
    throw new AppError(
      'An open process already exists for this vehicle — set its status before adding another.',
      StatusCodes.CONFLICT,
      4113,
    );
  }
}

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
  status?: VehicleProcessStatus | null;
  dealNumber?: string | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  priceCurrency?: string | null;
};

/**
 * Upserts the vehicle by `registrationNumber`, then creates a dealer-scoped process with
 * `processDate` defaulting to now. Optional `persons` are created in the same step;
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
    status,
    dealNumber,
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

  // At most one OPEN (status-less) process per vehicle per REAL dealer. The invariant only concerns
  // OPEN processes, so it applies only when this create is itself OPEN (no chosen status) — a
  // Sold/Complete/Scrap create is terminal and must never be blocked by an existing open process.
  // Skipped for agent-owned placeholder dealers: the status feature is dealer-only for now, so an
  // agent has no way to set a status and would otherwise be permanently blocked from re-creating.
  if (!dealer.isPlaceholder && !status) {
    await assertNoOpenProcessForVehicle(dealerId, upsert.vehicle.vehicleId);
  }

  // A process created directly as SOLD must include a buyer (same invariant as the status endpoint).
  if (status === 'SOLD' && !persons.some((p) => p.personType === 'BUYER')) {
    throw new AppError('Add a buyer before creating a Sold process.', StatusCodes.CONFLICT, 4114);
  }

  const processDate = processDateRaw?.trim()
    ? new Date(processDateRaw)
    : new Date();
  if (Number.isNaN(processDate.getTime())) {
    throw new AppError('Invalid process date', StatusCodes.UNPROCESSABLE_ENTITY, 4227);
  }

  await assertDealerReferencesForProcessStart(dealerId, processReferences);

  // Agent-created processes (on a placeholder the agent owns) get an agent-kanban position so they
  // appear in the agent board's first column; dealer-owned processes leave this null.
  const agentStatusId = await resolveInitialAgentStatusId(dealer);

  // Pre-compute the process id so uploaded documents can be relocated from the flat upload area into
  // this process's own folder (`{registration}_{processId}/…`) BEFORE the row is created — so the DB
  // is written once with folder-scoped keys that match where the files actually live.
  const processId = randomUUID();
  const relocatedUploadPhotos = await Promise.all(
    uploadPhotos.map(async (photo) => {
      const imageName = await uploadService.relocateToProcessFolder(
        photo.imageName,
        upsert.vehicle.registrationNumber,
        processId,
      );
      return { category: photo.category, imageName, originalKey: photo.imageName };
    }),
  );

  let process: VehicleProcessWithStartRelations;
  try {
    process = await vehicleProcessRepository.createVehicleProcess({
      processId,
      vehicleId: upsert.vehicle.vehicleId,
      dealerId,
      agentStatusId,
      processDate,
      status: status ?? null,
      dealNumber: dealNumber?.trim() ? dealNumber.trim() : null,
      purchasePrice: purchasePrice ?? null,
      salePrice: salePrice ?? null,
      priceCurrency: priceCurrency ?? null,
      persons: persons.map((p) => ({
        personName: p.personName,
        address: p.address ?? null,
        mobileNumber: p.mobileNumber,
        personType: p.personType,
      })),
      uploadPhotos: relocatedUploadPhotos.map(({ category, imageName }) => ({ category, imageName })),
      processReferences,
    });
  } catch (err) {
    // The files were moved before this write. Since no row was created, roll each move back to its
    // flat key so a client retry (which generates a fresh processId) still finds the uploaded bytes.
    await Promise.all(
      relocatedUploadPhotos
        .filter((p) => p.imageName !== p.originalKey)
        .map((p) => uploadService.tryMove(p.imageName, p.originalKey)),
    );
    throw err;
  }

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

  // Real dealers only — skip for agent-owned placeholder dealers (see startVehicleProcessWithVehicle).
  if (!dealer.isPlaceholder) {
    await assertNoOpenProcessForVehicle(input.dealerId, input.vehicleId);
  }

  const agentStatusId = await resolveInitialAgentStatusId(dealer);

  return vehicleProcessRepository.createVehicleProcess({
    vehicleId: input.vehicleId,
    dealerId: input.dealerId,
    agentStatusId,
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
 * A vehicle process list row with its tags flattened to `{ tagId, tagName, colour }` and the resolved
 * URL of its starred (primary) vehicle photo, or `null` when the process has no starred photo.
 */
export type VehicleProcessListDto = Omit<
  vehicleProcessRepository.VehicleProcessListItem,
  'processTags' | 'processUploadPhotos'
> & {
  tags: ProcessTagDto[];
  starredPhotoUrl: string | null;
};

/**
 * Flattens a list row's ProcessTag join rows into the shared `tags` shape (existing fields kept) and
 * resolves the starred vehicle photo (included at most once by the repository) to a public URL.
 *
 * @param row - Repository list row.
 * @param publicOrigin - Optional origin for local upload URL resolution.
 */
const toListItemDto = (
  row: vehicleProcessRepository.VehicleProcessListItem,
  publicOrigin?: string,
): VehicleProcessListDto => {
  const { processTags, processUploadPhotos, ...rest } = row;
  const starred = processUploadPhotos?.[0];
  return {
    ...rest,
    tags: processTags.map((pt) => pt.tag),
    starredPhotoUrl: starred ? resolvePhotoUrl(starred.imageName, publicOrigin) : null,
  };
};

/**
 * Lists vehicle processes, dealer-scoped when `dealerId` is provided (non-admin callers pass their
 * own dealer; super-admin passes null to see all). Fixes the prior cross-dealer leak. Each row
 * carries its `tags` (flat `{ tagId, tagName, colour }`).
 */
export async function listVehicleProcesses(
  query: PaginationQuery,
  dealerId?: string | null,
  search?: string | null,
  tagId?: string | null,
  status?: VehicleProcessStatusFilter | null,
  dateFrom?: string | null,
  dateTo?: string | null,
  publicOrigin?: string,
): Promise<PaginatedResult<VehicleProcessListDto>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await vehicleProcessRepository.listVehicleProcesses(
    skip,
    take,
    dealerId,
    search,
    tagId,
    status,
    dateFrom,
    dateTo,
  );
  const meta = buildPaginationMeta(total, query);
  return { data: items.map((item) => toListItemDto(item, publicOrigin)), meta };
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
  /** `DOCUMENT` (scans / legacy images) or `VEHICLE` (free-form vehicle photos). */
  kind: ProcessPhotoKind;
  /** The starred (primary/profile) vehicle photo. Always `false` for documents/legacy images. */
  isStarred: boolean;
}

/** The agent-uploaded RTO receipt (PDF or image) attached to a process. */
export interface VehicleProcessReceiptDto {
  imageName: string;
  photoUrl: string;
  uploadedAt: Date | null;
}

/** Aggregated vehicle process detail for a single read API. */
export interface VehicleProcessDetailsDto {
  processId: string;
  vehicleId: string | null;
  dealerId: string | null;
  agentStatusId: string | null;
  /** Fixed lifecycle status; `null` = OPEN (unset). */
  status: VehicleProcessStatus | null;
  /** Optional human-facing deal/reference number captured at creation. */
  dealNumber: string | null;
  /** When the process was first marked SOLD; `null` until sold. */
  soldDate: Date | null;
  /** When the active buyer was last replaced (change-buyer); `null` if never changed. */
  buyerChangedAt: Date | null;
  trackingNumber: string | null;
  receipt: VehicleProcessReceiptDto | null;
  processDate: Date | null;
  /** When the process row was created (used to detect creation-time persons for the party-date display). */
  createdAt: Date;
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
  /** Document photos: `DOCUMENT`-kind upload photos (cancelled-buyer IDs hidden) + legacy images. */
  photos: VehicleProcessPhotoDetailDto[];
  /** Free-form vehicle photos: `VEHICLE`-kind upload photos, oldest first (max 5). */
  vehiclePhotos: VehicleProcessPhotoDetailDto[];
  tags: ProcessTagDto[];
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
 * Builds the document photos array: `DOCUMENT`-kind upload photos (cancelled-buyer IDs hidden) plus
 * all legacy `ProcessUploadImage` rows (always treated as documents). Shape is unchanged from before
 * the `kind` split apart from the added `kind` field, so existing consumers stay compatible.
 *
 * @param row - Full process detail row from the repository.
 * @param publicOrigin - Optional origin for local upload URL resolution.
 */
const toPhotoDetails = (
  row: VehicleProcessDetailsRow,
  publicOrigin?: string,
): VehicleProcessPhotoDetailDto[] => {
  const fromPhotos: VehicleProcessPhotoDetailDto[] = row.processUploadPhotos
    // Only document-kind photos belong in the main grid; vehicle photos live in `vehiclePhotos`.
    .filter((photo) => photo.kind === 'DOCUMENT')
    // Hide a cancelled buyer's ID photos from the main grid — they show under that buyer instead.
    .filter((photo) => photo.person?.status !== 'CANCELLED')
    .map((photo) => ({
      processUploadPhotoId: photo.processUploadPhotoId,
      processUploadImageId: null,
      category: photo.category,
      imageName: photo.imageName,
      photoUrl: resolvePhotoUrl(photo.imageName, publicOrigin),
      kind: photo.kind,
      // Only vehicle photos can be starred; document-kind rows are never primary.
      isStarred: false,
    }));

  const fromImages: VehicleProcessPhotoDetailDto[] = row.processUploadImages.map((image) => ({
    processUploadPhotoId: null,
    processUploadImageId: image.processUploadImageId,
    category: image.dealerWiseUploadCategory.uploadCategory.categoryName,
    imageName: image.imageName,
    photoUrl: resolvePhotoUrl(image.imageLink || image.imageName, publicOrigin),
    // Legacy images are always documents.
    kind: 'DOCUMENT',
    isStarred: false,
  }));

  return [...fromPhotos, ...fromImages];
};

/**
 * Builds the vehicle photos array: `VEHICLE`-kind upload photos only, oldest first (the repository
 * already orders `processUploadPhotos` by `createdAt` ascending).
 *
 * @param row - Full process detail row from the repository.
 * @param publicOrigin - Optional origin for local upload URL resolution.
 */
const toVehiclePhotoDetails = (
  row: VehicleProcessDetailsRow,
  publicOrigin?: string,
): VehicleProcessPhotoDetailDto[] =>
  row.processUploadPhotos
    .filter((photo) => photo.kind === 'VEHICLE')
    .map((photo) => ({
      processUploadPhotoId: photo.processUploadPhotoId,
      processUploadImageId: null,
      category: photo.category,
      imageName: photo.imageName,
      photoUrl: resolvePhotoUrl(photo.imageName, publicOrigin),
      kind: photo.kind,
      isStarred: photo.isStarred,
    }));

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

  const ownerPerson = row.persons.find((p) => p.personType === 'SELLER' && p.status === 'ACTIVE') ?? null;
  // The live buyer is the ACTIVE one; cancelled (replaced) buyers are history shown separately.
  const buyerPerson = row.persons.find((p) => p.personType === 'BUYER' && p.status === 'ACTIVE') ?? null;

  const sellerRef =
    row.processReferences.find((r) => r.referenceType === 'SELL') ?? null;
  const buyerRef =
    row.processReferences.find((r) => r.referenceType === 'BUY') ?? null;

  return {
    processId: row.processId,
    vehicleId: row.vehicleId,
    dealerId: row.dealerId,
    agentStatusId: row.agentStatusId,
    status: row.status,
    dealNumber: row.dealNumber,
    soldDate: row.soldDate,
    buyerChangedAt: row.buyerChangedAt,
    trackingNumber: row.trackingNumber,
    receipt: row.receiptImageName
      ? {
          imageName: row.receiptImageName,
          photoUrl: resolvePhotoUrl(row.receiptImageName, publicOrigin),
          uploadedAt: row.receiptUploadedAt,
        }
      : null,
    processDate: row.processDate,
    createdAt: row.createdAt,
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
    vehiclePhotos: toVehiclePhotoDetails(row, publicOrigin),
    tags: row.processTags.map((pt) => pt.tag),
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
    processDate: new Date(input.processDate),
    purchasePrice: input.purchasePrice ?? null,
    salePrice: input.salePrice ?? null,
    priceCurrency: input.priceCurrency ?? null,
    // Only replace persons when the caller sent them; omitting leaves persons (incl. CANCELLED
    // buyers and their linked ID photos) untouched — see updateVehicleProcessSchema.
    persons: input.persons?.map((p) => ({
      personName: p.personName,
      address: p.address ?? null,
      mobileNumber: p.mobileNumber,
      personType: p.personType,
    })),
  });
}

/**
 * SOFT-deletes a process — moves it to the recycle bin by stamping `deletedAt`. The whole process is
 * hidden (every active query filters `deletedAt: null`) while its children (persons, docs, photos,
 * tasks, expenses, tags, references, comments, assignments) stay in the DB and return intact on
 * restore. Reads via {@link getVehicleProcessById}, so a process already in the bin 404s. Purged (hard
 * cascade delete) 7 days later. Scope/authorization is enforced by the controller before this call.
 *
 * @param processId - Vehicle process UUID.
 */
export async function deleteVehicleProcess(processId: string): Promise<void> {
  await getVehicleProcessById(processId);
  await vehicleProcessRepository.softDeleteVehicleProcess(processId);
}

/**
 * Loads a process WITHOUT the soft-delete filter (active or binned), or 404s. Used by the recycle-bin
 * flows (restore / permanent delete) so the controller can authorize a soft-deleted row's dealer.
 *
 * @param processId - Vehicle process UUID.
 */
export async function getVehicleProcessByIdIncludingDeleted(
  processId: string,
): Promise<VehicleProcessWithPersons> {
  const process = await vehicleProcessRepository.findVehicleProcessByIdIncludingDeleted(processId);
  if (!process) {
    throw new AppError('Vehicle process not found', StatusCodes.NOT_FOUND, 4050);
  }
  return process;
}

/**
 * Restores a soft-deleted process from the recycle bin (clears `deletedAt`); its untouched children
 * reappear whole. Scope/authorization is enforced by the controller before this call.
 *
 * @param processId - Vehicle process UUID.
 */
export async function restoreVehicleProcess(
  processId: string,
): Promise<VehicleProcessWithPersons> {
  await getVehicleProcessByIdIncludingDeleted(processId);
  await vehicleProcessRepository.restoreVehicleProcess(processId);
  return getVehicleProcessById(processId);
}

/**
 * PERMANENTLY deletes a process (the OLD hard cascade delete) — removes the process and all its
 * children immediately, whether it is active or already binned, then best-effort deletes its whole
 * per-process upload folder `"{registration}_{processId}/"` so no images are left orphaned on disk.
 * The folder cleanup runs AFTER the DB delete succeeds and never throws (a missing/undeletable folder
 * can't break the delete). Scope/authorization is enforced by the controller.
 *
 * @param processId - Vehicle process UUID.
 */
export async function permanentlyDeleteVehicleProcess(processId: string): Promise<void> {
  await getVehicleProcessByIdIncludingDeleted(processId);
  // Resolve the folder prefix BEFORE the DB delete (the vehicle link is gone afterwards).
  const registrationNumber =
    await vehicleProcessRepository.findVehicleRegistrationForProcess(processId);
  const folderPrefix = buildProcessFolderPrefix(registrationNumber, processId);
  await vehicleProcessRepository.deleteVehicleProcess(processId);
  await uploadService.deleteFolder(folderPrefix);
}

/** Days a soft-deleted process stays in the recycle bin before it is permanently purged. */
export const BIN_RETENTION_DAYS = 7;

/** A recycle-bin list row: what the UI needs to show the binned process and its "N days left". */
export interface BinProcessDto {
  processId: string;
  registrationNumber: string | null;
  ownerName: string | null;
  deletedAt: Date | null;
  /** When this process will be permanently purged (`deletedAt` + {@link BIN_RETENTION_DAYS} days). */
  purgeAt: Date | null;
  /** Whole days until purge (0 once due); `null` when `deletedAt` is somehow absent. */
  daysLeft: number | null;
}

/** Milliseconds in one day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds in one hour — the unit for the orphan-root-upload retention window. */
const HOUR_MS = 60 * 60 * 1000;

/**
 * Maps a bin repository row to its DTO, computing `purgeAt` (`deletedAt` + retention) and a
 * clamped-at-zero whole-day `daysLeft` for the "N days left" badge. Prefers the ACTIVE seller as the
 * displayed owner name, falling back to the first person on the process.
 *
 * @param row - Bin row from the repository (vehicle registration + persons included).
 */
const toBinProcessDto = (
  row: vehicleProcessRepository.BinProcessRow,
): BinProcessDto => {
  const deletedAt = row.deletedAt;
  const purgeAt = deletedAt ? new Date(deletedAt.getTime() + BIN_RETENTION_DAYS * DAY_MS) : null;
  const daysLeft = purgeAt
    ? Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / DAY_MS))
    : null;
  const owner =
    row.persons.find((p) => p.personType === 'SELLER' && p.status === 'ACTIVE') ??
    row.persons[0] ??
    null;
  return {
    processId: row.processId,
    registrationNumber: row.vehicle?.registrationNumber ?? null,
    ownerName: owner?.personName ?? null,
    deletedAt,
    purgeAt,
    daysLeft,
  };
};

/**
 * Purges expired recycle-bin processes FIRST (so the bin never shows an already-due row), then returns
 * the paginated bin list for the given scope (`null` dealerId = all dealers, for super-admin).
 *
 * @param query - Pagination query (`page`/`limit`).
 * @param dealerId - Dealer scope, or `null` for all dealers (super-admin).
 */
export async function listBin(
  query: PaginationQuery,
  dealerId?: string | null,
): Promise<PaginatedResult<BinProcessDto>> {
  await purgeExpiredBinProcesses();
  const { skip, take } = parsePagination(query);
  const { items, total } = await vehicleProcessRepository.listBinProcessesForDealer(
    dealerId,
    skip,
    take,
  );
  const meta = buildPaginationMeta(total, query);
  return { data: items.map(toBinProcessDto), meta };
}

/**
 * Purges expired recycle-bin processes FIRST (lazy purge, never throws), then returns the paginated
 * agent-global recycle bin: the caller agent's own binned processes across ALL placeholder dealers
 * they own — the agent-global counterpart of {@link listBin} (mirrors {@link listAgentBoardProcesses})
 * mapped to the SAME {@link BinProcessDto} shape via {@link toBinProcessDto}.
 *
 * @param agentId - The owning agent (from the caller's token).
 * @param query - Pagination query (`page`/`limit`).
 */
export async function listAgentBin(
  agentId: string,
  query: PaginationQuery,
): Promise<PaginatedResult<BinProcessDto>> {
  await purgeExpiredBinProcesses();
  const { skip, take } = parsePagination(query);
  const { items, total } = await vehicleProcessRepository.listBinProcessesForAgent(
    agentId,
    skip,
    take,
  );
  const meta = buildPaginationMeta(total, query);
  return { data: items.map(toBinProcessDto), meta };
}

/**
 * Hard-deletes every process binned more than {@link BIN_RETENTION_DAYS} days ago (cascading to all
 * children), then best-effort deletes each purged process's per-process upload folder so no images are
 * left orphaned on disk. The candidate list (id + registration) is fetched FIRST so folder prefixes can
 * be computed before the vehicle links are gone; each candidate is then deleted with an ATOMIC
 * "still expired?" guard ({@link vehicleProcessRepository.hardDeleteExpiredProcessById}) so a process
 * restored between the scan and the delete survives and its folder is left intact (closes the purge
 * TOCTOU race). A folder is cleaned ONLY for a row this sweep actually deleted. Called lazily on every
 * bin view and on the daily server sweep, so it must NEVER throw — failures are logged (per-row and
 * overall) and it resolves to the count purged so far.
 *
 * @returns The number of processes purged (0 on failure).
 */
export async function purgeExpiredBinProcesses(): Promise<number> {
  let purged = 0;
  try {
    const cutoff = new Date(Date.now() - BIN_RETENTION_DAYS * DAY_MS);
    const candidates = await vehicleProcessRepository.findProcessesToPurge(cutoff);
    for (const { processId, registrationNumber } of candidates) {
      try {
        const n = await vehicleProcessRepository.hardDeleteExpiredProcessById(processId, cutoff);
        if (n > 0) {
          // Only clean the folder for a row THIS sweep actually deleted (not a restored survivor).
          await uploadService.deleteFolder(buildProcessFolderPrefix(registrationNumber, processId));
          purged += n;
        }
      } catch (err) {
        logUnknownError('Failed to purge expired recycle-bin vehicle process', err);
      }
    }
  } catch (err) {
    logUnknownError('Failed to purge expired recycle-bin vehicle processes', err);
  }
  return purged;
}

/**
 * Strips any folder and any URL query/hash from an upload value, leaving just the trailing basename —
 * e.g. `"AB12CD_<pid>/x.jpg"` and `"https://host/uploads/x.jpg?v=2"` both become `"x.jpg"`. Used to
 * protect scoped-but-actually-flat values, legacy flat keys, and bare-key-or-URL `imageLink`s.
 *
 * @param value - A raw referenced upload value (object key or URL).
 */
const basenameOfUploadValue = (value: string): string => {
  return value.split(/[/\\]/).pop()?.split(/[?#]/)[0] ?? value;
};

/**
 * Builds the set of upload keys still referenced by ANY DB row, so the orphan-root-upload sweep never
 * deletes a live file. Reads the only four upload-key columns — `ProcessUploadPhoto.imageName`,
 * `VehicleProcess.receiptImageName`, and the legacy `ProcessUploadImage.imageName` + `imageLink` — with
 * NO `deletedAt` filter (soft-deleted processes still own their files). For every non-null value it adds
 * BOTH the raw value AND its {@link basenameOfUploadValue basename}, so a flat root key matches whether
 * it is stored raw, folder-scoped, or embedded in a full URL.
 */
async function buildReferencedUploadKeySet(): Promise<Set<string>> {
  const [photoImageNames, receiptImageNames, uploadImageRows] = await Promise.all([
    processUploadPhotoRepository.findAllImageNames(),
    vehicleProcessRepository.findAllReceiptImageNames(),
    processUploadImageRepository.findAllUploadImageKeys(),
  ]);
  const referenced = new Set<string>();
  const add = (value: string | null): void => {
    if (!value) {
      return;
    }
    referenced.add(value);
    referenced.add(basenameOfUploadValue(value));
  };
  photoImageNames.forEach(add);
  receiptImageNames.forEach(add);
  uploadImageRows.forEach((row) => {
    add(row.imageName);
    add(row.imageLink);
  });
  return referenced;
}

/**
 * Deletes ORPHANED flat upload files left in the storage root: bare server-generated `{uuid}.{ext}`
 * files that were never attached to a process (attach MOVES them into a per-process folder). A file is
 * deleted ONLY when ALL three hold: (1) its key matches {@link isGeneratedFileKey} (so only files this
 * server created can ever be removed), (2) it is older than the `ORPHAN_UPLOAD_RETENTION_HOURS` window
 * (a fresh two-step upload mid-attach is spared), and (3) neither the key NOR its basename is in the
 * referenced-key set from {@link buildReferencedUploadKeySet}. Mirrors {@link purgeExpiredBinProcesses}:
 * it NEVER throws — an outer try/catch guards the scan and a per-file try/catch guards each delete, both
 * logging via {@link logUnknownError}, so one failure never aborts the sweep. Called on a daily server
 * sweep.
 *
 * @returns The number of orphaned files deleted (0 on failure).
 */
export async function purgeOrphanRootUploads(): Promise<number> {
  let deleted = 0;
  try {
    const cutoff = new Date(Date.now() - config.ORPHAN_UPLOAD_RETENTION_HOURS * HOUR_MS);
    // List the root FIRST, then snapshot referenced keys as late as possible (right before the delete
    // loop) so any process attached during the sweep is captured in the set and its file is spared.
    const rootFiles = await uploadService.listRootFiles();
    const referenced = await buildReferencedUploadKeySet();
    for (const { key, lastModified } of rootFiles) {
      try {
        // Only ever delete server-generated flat upload keys (uuid.ext).
        if (!isGeneratedFileKey(key)) {
          continue;
        }
        // Spare files inside the retention window (e.g. a two-step upload still mid-attach).
        if (lastModified >= cutoff) {
          continue;
        }
        // Spare anything a DB row still points at (raw key or basename).
        if (referenced.has(key) || referenced.has(basenameOfUploadValue(key))) {
          continue;
        }
        await uploadService.deleteFile(key);
        deleted += 1;
      } catch (err) {
        logUnknownError('Failed to delete orphaned root upload file', err);
      }
    }
  } catch (err) {
    logUnknownError('Failed to purge orphaned root upload files', err);
  }
  return deleted;
}

/** Compact card for the agent board (agent-created / placeholder-dealer processes). */
export interface AgentBoardProcessDto {
  processId: string;
  agentStatusId: string | null;
  agentStatus: { statusId: string; statusName: string; colour: string | null } | null;
  vehicle: { registrationNumber: string } | null;
  dealer: { dealerId: string; firmName: string } | null;
  tags: ProcessTagDto[];
  createdAt: Date;
}

/** Maps a repository board row to the compact card DTO (tags flattened to `{ tagId, tagName, colour }`). */
const toAgentBoardProcessDto = (row: AgentBoardProcessRow): AgentBoardProcessDto => ({
  processId: row.processId,
  agentStatusId: row.agentStatusId,
  agentStatus: row.agentStatus,
  vehicle: row.vehicle,
  dealer: row.dealer,
  tags: row.processTags.map((pt) => pt.tag),
  createdAt: row.createdAt,
});

/**
 * Lists an agent's own (agent-created, placeholder-dealer) processes for the agent board.
 *
 * @param agentId - The owning agent (from the caller's token).
 */
export async function listAgentBoardProcesses(agentId: string): Promise<AgentBoardProcessDto[]> {
  const rows = await vehicleProcessRepository.listProcessesForAgentBoard(agentId);
  return rows.map(toAgentBoardProcessDto);
}

/**
 * Moves an agent-created process into one of the owning agent's kanban columns. The process must be
 * on a placeholder dealer (which has an owner agent) and the target status must belong to that agent.
 * The caller's authorization for the process's dealer is asserted by the controller before this call.
 *
 * @param processId - Vehicle process UUID.
 * @param dealerId - The process's (placeholder) dealer, resolved by the controller.
 * @param agentStatusId - Target agent status UUID.
 * @throws AppError 422/4234 when the process has no agent board or the status is not the agent's.
 */
export async function updateVehicleProcessAgentStatus(
  processId: string,
  dealerId: string,
  agentStatusId: string,
): Promise<VehicleProcessWithPersons> {
  const dealer = await dealerRepository.findDealerById(dealerId);
  const ownerAgentId = dealer?.ownerAgentId ?? null;
  if (!dealer?.isPlaceholder || !ownerAgentId) {
    throw new AppError(
      'This process is not on an agent-managed board',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4234,
    );
  }
  const status = await agentStatusRepository.findAgentStatusOwnedByAgent(ownerAgentId, agentStatusId);
  if (!status) {
    throw new AppError('Invalid status for this agent', StatusCodes.UNPROCESSABLE_ENTITY, 4234);
  }
  await vehicleProcessRepository.updateProcessAgentStatus(processId, agentStatusId);
  return getVehicleProcessById(processId);
}

/**
 * Sets/replaces a process's RTO receipt: relocates the flat-uploaded file into the process folder,
 * then stores its key + upload time. On a write failure the move is rolled back to the flat key so a
 * retry still finds the bytes. The caller (controller) authorizes the agent before this call.
 *
 * @param processId - Vehicle process UUID.
 * @param imageName - The flat upload key of the receipt file.
 */
export async function setProcessReceipt(
  processId: string,
  imageName: string,
): Promise<VehicleProcessWithPersons> {
  const registrationNumber =
    await vehicleProcessRepository.findVehicleRegistrationForProcess(processId);
  const originalKey = imageName.trim();
  const relocatedKey = await uploadService.relocateToProcessFolder(
    originalKey,
    registrationNumber,
    processId,
  );
  try {
    await vehicleProcessRepository.updateProcessReceipt(processId, relocatedKey, new Date());
  } catch (err) {
    if (relocatedKey !== originalKey) {
      await uploadService.tryMove(relocatedKey, originalKey);
    }
    throw err;
  }
  return getVehicleProcessById(processId);
}

/**
 * Clears a process's RTO receipt (the underlying file is left on disk). Authorized by the controller.
 *
 * @param processId - Vehicle process UUID.
 */
export async function clearProcessReceipt(processId: string): Promise<VehicleProcessWithPersons> {
  await vehicleProcessRepository.updateProcessReceipt(processId, null, null);
  return getVehicleProcessById(processId);
}

/**
 * Sets or clears a process's RC-book tracking number (blank clears it). Authorized by the controller.
 *
 * @param processId - Vehicle process UUID.
 * @param trackingNumber - The tracking number (empty/blank clears it).
 */
export async function setProcessTrackingNumber(
  processId: string,
  trackingNumber: string,
): Promise<VehicleProcessWithPersons> {
  const trimmed = trackingNumber.trim();
  await vehicleProcessRepository.updateProcessTrackingNumber(
    processId,
    trimmed.length > 0 ? trimmed : null,
  );
  return getVehicleProcessById(processId);
}

/**
 * Sets or clears a process's fixed lifecycle status. A terminal value (SOLD/COMPLETE/SCRAP) is always
 * allowed. Clearing back to OPEN (`null`) is rejected when ANOTHER open process already exists for the
 * same vehicle under the same dealer — preserving the "at most one open process per vehicle per
 * dealer" invariant. The caller (controller) authorizes the process's dealer before this call.
 *
 * @param processId - Vehicle process UUID.
 * @param status - A terminal status, or `null` to reopen the process.
 * @throws AppError 409/4113 when reopening would create a second open process for the vehicle.
 */
export async function setVehicleProcessStatus(
  processId: string,
  status: VehicleProcessStatus | null,
): Promise<VehicleProcessWithPersons> {
  const process = await getVehicleProcessById(processId);
  if (status === null && process.dealerId && process.vehicleId) {
    // Only real dealers enforce the single-open invariant (dealer-only feature; placeholder-dealer
    // processes created by agents are never blocked).
    const dealer = await dealerRepository.findDealerById(process.dealerId);
    if (!dealer?.isPlaceholder) {
      await assertNoOpenProcessForVehicle(process.dealerId, process.vehicleId, processId);
    }
  }

  // A process can only be marked SOLD once it has an active buyer (the frontend prompts to add one).
  if (status === 'SOLD') {
    const hasActiveBuyer = process.persons.some(
      (p) => p.personType === 'BUYER' && p.status === 'ACTIVE',
    );
    if (!hasActiveBuyer) {
      throw new AppError('Add a buyer before marking this process as Sold.', StatusCodes.CONFLICT, 4114);
    }
  }

  // soldDate: stamp the first time it becomes SOLD (preserve the original on re-SOLD); PRESERVE it
  // through COMPLETE (sold-then-completed); CLEAR it when reopening to OPEN or moving to SCRAP (those
  // are not sold states). `undefined` leaves the column untouched in the repo.
  const soldDate =
    status === 'SOLD'
      ? process.soldDate ?? new Date()
      : status === 'COMPLETE'
        ? undefined
        : null;
  await vehicleProcessRepository.updateVehicleProcessStatus(processId, status, soldDate);
  return getVehicleProcessById(processId);
}

/**
 * Edits the recorded sold date of a process. Only allowed once a process has been sold (has a
 * soldDate); otherwise there is nothing to edit. The caller (controller) authorizes the dealer.
 *
 * @param processId - Vehicle process UUID.
 * @param soldDate - The new sold date.
 * @throws AppError 4115 when the process has not been marked Sold yet.
 */
export async function updateVehicleProcessSoldDate(
  processId: string,
  soldDate: Date,
): Promise<VehicleProcessWithPersons> {
  const process = await getVehicleProcessById(processId);
  if (!process.soldDate) {
    throw new AppError('This process has not been marked Sold yet.', StatusCodes.CONFLICT, 4115);
  }
  await vehicleProcessRepository.updateVehicleProcessSoldDate(processId, soldDate);
  return getVehicleProcessById(processId);
}

/**
 * Full-replaces a process's tags. Every tagId must belong to the process's dealer (`dealerId`,
 * resolved and authorized by the controller); an empty `tagIds` clears all tags. Duplicate ids in the
 * request are de-duplicated before the ownership check. Returns the resulting tags in the flat
 * `{ tagId, tagName, colour }` shape.
 *
 * @param processId - Vehicle process UUID.
 * @param dealerId - The process's dealer (authorized by the controller).
 * @param tagIds - The full replacement set of dealer tag UUIDs (may be empty).
 * @throws AppError 422 (4235) when one or more tags do not belong to the dealer.
 */
export async function setVehicleProcessTags(
  processId: string,
  dealerId: string,
  tagIds: string[],
): Promise<ProcessTagDto[]> {
  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length > 0) {
    const ownedCount = await dealerTagRepository.countDealerTagsByIds(dealerId, uniqueTagIds);
    if (ownedCount !== uniqueTagIds.length) {
      throw new AppError(
        'One or more tags do not belong to this dealer',
        StatusCodes.UNPROCESSABLE_ENTITY,
        4235,
      );
    }
  }
  return processTagRepository.setProcessTags(processId, uniqueTagIds);
}

// Explicit export to make it easy to reference in docs/types.
export type { VehicleProcess };

