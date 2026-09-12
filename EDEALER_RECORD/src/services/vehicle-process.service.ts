import { StatusCodes } from 'http-status-codes';
import type { Vehicle, VehicleProcess, VehicleProcessStatus } from '@prisma/client';
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
import { uploadService } from './upload.service';
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

  // At most one OPEN (status-less) process per vehicle per REAL dealer — new processes start open.
  // Skipped for agent-owned placeholder dealers: the status feature is dealer-only for now, so an
  // agent has no way to set a status and would otherwise be permanently blocked from re-creating.
  if (!dealer.isPlaceholder) {
    await assertNoOpenProcessForVehicle(dealerId, upsert.vehicle.vehicleId);
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

/** A vehicle process list row with its tags flattened to `{ tagId, tagName, colour }`. */
export type VehicleProcessListDto = Omit<
  vehicleProcessRepository.VehicleProcessListItem,
  'processTags'
> & {
  tags: ProcessTagDto[];
};

/** Flattens a list row's ProcessTag join rows into the shared `tags` shape (existing fields kept). */
const toListItemDto = (
  row: vehicleProcessRepository.VehicleProcessListItem,
): VehicleProcessListDto => {
  const { processTags, ...rest } = row;
  return { ...rest, tags: processTags.map((pt) => pt.tag) };
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
): Promise<PaginatedResult<VehicleProcessListDto>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await vehicleProcessRepository.listVehicleProcesses(
    skip,
    take,
    dealerId,
    search,
    tagId,
    status,
  );
  const meta = buildPaginationMeta(total, query);
  return { data: items.map(toListItemDto), meta };
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
  trackingNumber: string | null;
  receipt: VehicleProcessReceiptDto | null;
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
 * Builds the unified photos array from upload photo and upload image tables.
 *
 * @param row - Full process detail row from the repository.
 * @param publicOrigin - Optional origin for local upload URL resolution.
 */
const toPhotoDetails = (
  row: VehicleProcessDetailsRow,
  publicOrigin?: string,
): VehicleProcessPhotoDetailDto[] => {
  const fromPhotos: VehicleProcessPhotoDetailDto[] = row.processUploadPhotos
    // Hide a cancelled buyer's ID photos from the main grid — they show under that buyer instead.
    .filter((photo) => photo.person?.status !== 'CANCELLED')
    .map((photo) => ({
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
    trackingNumber: row.trackingNumber,
    receipt: row.receiptImageName
      ? {
          imageName: row.receiptImageName,
          photoUrl: resolvePhotoUrl(row.receiptImageName, publicOrigin),
          uploadedAt: row.receiptUploadedAt,
        }
      : null,
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

export async function deleteVehicleProcess(processId: string): Promise<void> {
  await getVehicleProcessById(processId);
  await vehicleProcessRepository.deleteVehicleProcess(processId);
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
  await vehicleProcessRepository.updateVehicleProcessStatus(processId, status);
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

