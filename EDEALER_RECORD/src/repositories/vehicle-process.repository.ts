import { prisma } from '../config/prisma';
import type {
  PersonType,
  PersonStatus,
  VehicleProcess,
  VehicleProcessStatus,
  Person,
  ProcessExpense,
  ProcessUploadPhoto,
  ProcessReference,
  ReferenceType,
  Vehicle,
  DealerReference,
  ProcessUploadImage,
  DealerWiseUploadCategory,
  UploadCategory,
  Prisma,
} from '@prisma/client';

/**
 * A list-filter value for a process's lifecycle status: a concrete terminal status, or the sentinel
 * `'OPEN'` (matches status-less processes), or absent (no status filter).
 */
export type VehicleProcessStatusFilter = VehicleProcessStatus | 'OPEN';

export type VehicleProcessWithPersons = VehicleProcess & { persons: Person[] };

/** A process with its persons AND booked expenses — used to build per-vehicle history + net profit. */
export type VehicleProcessWithPersonsAndExpenses = VehicleProcessWithPersons & {
  processExpenses: ProcessExpense[];
  processReferences: (ProcessReference & { reference: DealerReference | null })[];
};

/** A tag join row selected on a process read, carrying only the flat tag summary. */
export type ProcessTagSelection = { tag: { tagId: string; tagName: string; colour: string | null } };

/** Prisma select for a process's tags (flat `{ tagId, tagName, colour }` via the ProcessTag join). */
const processTagsSelect = {
  select: { tag: { select: { tagId: true, tagName: true, colour: true } } },
  orderBy: { tag: { tagName: 'asc' } },
} satisfies Prisma.VehicleProcess$processTagsArgs;

/** List row: persons plus the vehicle (for showing the vehicle/registration number) and tags. */
export type VehicleProcessListItem = VehicleProcess & {
  persons: Person[];
  vehicle: Vehicle | null;
  processTags: ProcessTagSelection[];
  /** At most the single starred VEHICLE-kind photo (for the list row thumbnail); empty otherwise. */
  processUploadPhotos: ProcessUploadPhoto[];
};

export type VehicleProcessWithStartRelations = VehicleProcess & {
  persons: Person[];
  processUploadPhotos: ProcessUploadPhoto[];
  processReferences: ProcessReference[];
};

export type ProcessReferenceWithDealerReference = ProcessReference & {
  reference: DealerReference | null;
};

export type ProcessUploadImageWithCategory = ProcessUploadImage & {
  dealerWiseUploadCategory: DealerWiseUploadCategory & {
    uploadCategory: UploadCategory;
  };
};

/** An upload photo with its optional owner-person status (to hide cancelled-buyer IDs from the grid). */
export type ProcessUploadPhotoWithPerson = ProcessUploadPhoto & {
  person: { status: PersonStatus; personType: PersonType } | null;
};

export type VehicleProcessDetailsRow = VehicleProcess & {
  vehicle: Vehicle | null;
  persons: Person[];
  processReferences: ProcessReferenceWithDealerReference[];
  processUploadPhotos: ProcessUploadPhotoWithPerson[];
  processUploadImages: ProcessUploadImageWithCategory[];
  processTags: ProcessTagSelection[];
};

export interface PersonInputData {
  personName: string;
  address?: string | null;
  mobileNumber: string;
  personType: PersonType;
}

export interface StartUploadPhotoInputData {
  category: string;
  imageName: string;
}

export interface StartProcessReferenceInputData {
  referenceId: string;
  referenceType: ReferenceType;
}

export interface CreateVehicleProcessData {
  /** Optional explicit PK. When provided (e.g. to pre-compute the per-process upload folder before
   *  creating the row), it overrides the DB-generated UUID default. */
  processId?: string;
  vehicleId: string;
  dealerId: string;
  /** Optional agent-kanban column for agent-created (placeholder) processes shown on the agent board. */
  agentStatusId?: string | null;
  /** Optional chosen lifecycle status; `null` = OPEN (status-less). */
  status?: VehicleProcessStatus | null;
  /** Optional human-facing deal/reference number captured at creation (free-text, ≤100 chars). */
  dealNumber?: string | null;
  processDate: Date;
  persons: PersonInputData[];
  purchasePrice?: number | null;
  salePrice?: number | null;
  priceCurrency?: string | null;
  uploadPhotos?: StartUploadPhotoInputData[];
  processReferences?: StartProcessReferenceInputData[];
}

/**
 * A vehicle process card for the agent board: the agent-kanban status, vehicle registration, and the
 * source (placeholder) dealer summary. Returned by {@link listProcessesForAgentBoard}.
 */
export type AgentBoardProcessRow = VehicleProcess & {
  vehicle: { registrationNumber: string } | null;
  dealer: { dealerId: string; firmName: string } | null;
  agentStatus: { statusId: string; statusName: string; colour: string | null } | null;
  processTags: ProcessTagSelection[];
};

export interface UpdateVehicleProcessData {
  vehicleId: string;
  dealerId: string;
  processDate: Date;
  /** Omit to leave persons untouched; provide to full-replace the process's persons. */
  persons?: PersonInputData[];
  purchasePrice?: number | null;
  salePrice?: number | null;
  priceCurrency?: string | null;
}

export async function createVehicleProcess(
  data: CreateVehicleProcessData,
): Promise<VehicleProcessWithStartRelations> {
  const uploadPhotos = data.uploadPhotos ?? [];
  const processReferences = data.processReferences ?? [];

  return prisma.vehicleProcess.create({
    data: {
      ...(data.processId ? { processId: data.processId } : {}),
      vehicleId: data.vehicleId,
      dealerId: data.dealerId,
      agentStatusId: data.agentStatusId ?? null,
      status: data.status ?? null,
      // Stamp the sold date when a process is born SOLD (the wizard can pick SOLD at creation) — use the
      // chosen process date (the deal date) so it matches the buyer's recorded date; else null.
      soldDate: data.status === 'SOLD' ? data.processDate ?? new Date() : null,
      dealNumber: data.dealNumber ?? null,
      processDate: data.processDate,
      purchasePrice: data.purchasePrice ?? null,
      salePrice: data.salePrice ?? null,
      ...(data.priceCurrency ? { priceCurrency: data.priceCurrency } : {}),
      persons: {
        create: data.persons.map((p) => ({
          personName: p.personName,
          address: p.address ?? null,
          mobileNumber: p.mobileNumber,
          personType: p.personType,
        })),
      },
      processUploadPhotos: {
        create: uploadPhotos.map((photo) => ({
          category: photo.category,
          imageName: photo.imageName,
        })),
      },
      processReferences: {
        create: processReferences.map((ref) => ({
          referenceId: ref.referenceId,
          dealerId: data.dealerId,
          referenceType: ref.referenceType,
        })),
      },
    },
    include: {
      persons: true,
      processUploadPhotos: true,
      processReferences: true,
    },
  });
}

export async function listVehicleProcesses(
  skip: number,
  take: number,
  dealerId?: string | null,
  search?: string | null,
  tagId?: string | null,
  status?: VehicleProcessStatusFilter | null,
  dateFrom?: string | null,
  dateTo?: string | null,
): Promise<{ items: VehicleProcessListItem[]; total: number }> {
  // Dealer-scoped when a dealerId is given (non-admin); `{ equals }` is null-safe.
  // `deletedAt: null` hides soft-deleted (binned) processes from every active list + count.
  const where: Prisma.VehicleProcessWhereInput = {
    deletedAt: null,
    ...(dealerId ? { dealerId: { equals: dealerId } } : {}),
  };
  // Inclusive processDate range (dashboard date-range picker); either bound is optional.
  if (dateFrom || dateTo) {
    where.processDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  // Lifecycle-status filter (AND-ed with search/tag): 'OPEN' → status-less rows; a terminal value →
  // exact match; absent → no filter.
  if (status === 'OPEN') {
    where.status = null;
  } else if (status) {
    where.status = status;
  }
  const term = search?.trim();
  if (term) {
    // Registration numbers are stored normalized (no spaces/punctuation), so match a space-stripped
    // term against them; person names match the raw term. Both case-insensitive.
    const regTerm = term.replace(/[^a-zA-Z0-9]/g, '');
    const or: Prisma.VehicleProcessWhereInput[] = [
      { persons: { some: { personName: { contains: term, mode: 'insensitive' } } } },
    ];
    if (regTerm) {
      or.push({ vehicle: { is: { registrationNumber: { contains: regTerm, mode: 'insensitive' } } } });
    }
    where.OR = or;
  }
  if (tagId) {
    // Server-side tag filter so both the results and the pagination totals reflect the tag.
    where.processTags = { some: { tagId } };
  }
  const [items, total] = await Promise.all([
    prisma.vehicleProcess.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        persons: true,
        vehicle: true,
        processTags: processTagsSelect,
        // Only the starred (primary) vehicle photo travels on a list row, for its thumbnail.
        processUploadPhotos: { where: { kind: 'VEHICLE', isStarred: true }, take: 1 },
      },
    }),
    prisma.vehicleProcess.count({ where }),
  ]);
  return { items, total };
}

/** Which date column an export filters on. */
export type ExportDateField = 'processDate' | 'soldDate';

/**
 * Returns just the process IDs (newest first) in a dealer-scoped date range for the export, ranged on
 * either `processDate` (default) or `soldDate`. Lean on purpose — the export then loads full details
 * per id. Soft-deleted rows are excluded; a `soldDate` range naturally excludes never-sold processes.
 *
 * @param dealerId - Dealer scope (null = all dealers, super-admin).
 * @param dateFrom - Inclusive lower ISO bound, or null.
 * @param dateTo - Inclusive upper ISO bound, or null.
 * @param dateField - The date column to range on.
 * @param take - Max rows to return.
 */
export async function findProcessIdsForExport(
  dealerId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  dateField: ExportDateField,
  statuses: VehicleProcessStatusFilter[],
  take: number,
): Promise<{ ids: string[]; total: number }> {
  const where: Prisma.VehicleProcessWhereInput = {
    deletedAt: null,
    ...(dealerId ? { dealerId: { equals: dealerId } } : {}),
  };
  if (dateFrom || dateTo) {
    const range: Prisma.DateTimeNullableFilter = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
    if (dateField === 'soldDate') where.soldDate = range;
    else where.processDate = range;
  }
  // Status filter (the 4 are OPEN/SOLD/COMPLETE/SCRAP). Empty or all four → no filter (all). 'OPEN'
  // maps to a null status column; terminal values use `status IN (...)`.
  if (statuses.length > 0 && statuses.length < 4) {
    const terminals = statuses.filter((s): s is VehicleProcessStatus => s !== 'OPEN');
    const hasOpen = statuses.includes('OPEN');
    if (hasOpen && terminals.length > 0) {
      where.OR = [{ status: null }, { status: { in: terminals } }];
    } else if (hasOpen) {
      where.status = null;
    } else {
      where.status = { in: terminals };
    }
  }
  const [rows, total] = await Promise.all([
    prisma.vehicleProcess.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      select: { processId: true },
    }),
    prisma.vehicleProcess.count({ where }),
  ]);
  return { ids: rows.map((r) => r.processId), total };
}

/**
 * Loads a dealer's own processes for one vehicle (with persons), oldest first (NULL dates last).
 * `dealerId: { equals }` is null-safe — it never matches the `undefined`/all rows.
 *
 * @param vehicleId - Vehicle UUID.
 * @param dealerId - The caller's dealer; only their own rows are returned (privacy).
 */
export async function listProcessesForVehicleByDealer(
  vehicleId: string,
  dealerId: string,
): Promise<VehicleProcessWithPersonsAndExpenses[]> {
  return prisma.vehicleProcess.findMany({
    // `deletedAt: null` keeps binned processes out of the per-vehicle history + profit aggregation.
    where: { vehicleId, dealerId: { equals: dealerId }, deletedAt: null },
    include: { persons: true, processExpenses: true, processReferences: { include: { reference: true } } },
    orderBy: [{ processDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });
}

/** Anonymized cross-dealer market signal for a vehicle — coarse, non-attributable counts ONLY (no price, PII, dates, or dealer identity). */
export interface VehicleMarketSignal {
  changedHands: number;
  dealersInvolved: number;
}

/**
 * Computes the anonymized "changed hands" signal across ALL dealers for a vehicle. Returns only
 * coarse, non-attributable counts — never any price, person PII, transaction date, or dealer
 * identity. (A first/last transaction *year* was deliberately dropped: a min/max processDate over
 * all dealers would leak a competitor's transaction timing to a caller who handled the vehicle.)
 *
 * @param vehicleId - Vehicle UUID.
 */
export async function getVehicleMarketSignal(vehicleId: string): Promise<VehicleMarketSignal> {
  const [changedHands, distinctDealers] = await Promise.all([
    prisma.vehicleProcess.count({
      // Binned (soft-deleted) processes never contribute to the anonymized market signal.
      where: { vehicleId, deletedAt: null, persons: { some: { personType: 'BUYER' } } },
    }),
    prisma.vehicleProcess.findMany({
      where: { vehicleId, deletedAt: null, dealerId: { not: null } },
      select: { dealerId: true },
      distinct: ['dealerId'],
    }),
  ]);
  return {
    changedHands,
    dealersInvolved: distinctDealers.length,
  };
}

export async function findVehicleProcessById(
  processId: string,
): Promise<VehicleProcessWithPersons | null> {
  // `findFirst` (not `findUnique`) so the `deletedAt: null` filter applies — a binned process reads as
  // absent, so the detail/update/status/tags/receipt endpoints all 404 for it.
  return prisma.vehicleProcess.findFirst({
    where: { processId, deletedAt: null },
    include: { persons: true },
  });
}

/**
 * Loads a process by id WITHOUT the soft-delete filter (binned or active) — used only by the recycle
 * bin flows (restore / permanent delete) that legitimately need to see a soft-deleted row.
 *
 * @param processId - Vehicle process UUID.
 */
export async function findVehicleProcessByIdIncludingDeleted(
  processId: string,
): Promise<VehicleProcessWithPersons | null> {
  return prisma.vehicleProcess.findUnique({
    where: { processId },
    include: { persons: true },
  });
}

/**
 * Finds an OPEN (status-less) process for a vehicle within one dealer — the guard behind the
 * "at most one open process per vehicle per dealer" invariant. Enforced in the service (there is no
 * DB constraint, because it is a null-scoped uniqueness rule).
 *
 * @param dealerId - The owning dealer.
 * @param vehicleId - The vehicle to look under.
 * @param excludeProcessId - When given, ignore this process (used when clearing a status back to open).
 * @returns The first matching open process, or `null` when none exists.
 */
export async function findOpenProcessForVehicle(
  dealerId: string,
  vehicleId: string,
  excludeProcessId?: string,
): Promise<VehicleProcess | null> {
  return prisma.vehicleProcess.findFirst({
    where: {
      dealerId,
      vehicleId,
      status: null,
      // A binned open process must NOT block creating a new one — ignore soft-deleted rows.
      deletedAt: null,
      ...(excludeProcessId ? { processId: { not: excludeProcessId } } : {}),
    },
  });
}

/**
 * Returns the registration number of a process's linked vehicle (or `null`). Used to build the
 * per-process upload folder when documents are added to an existing process.
 *
 * @param processId - Vehicle process UUID.
 */
export async function findVehicleRegistrationForProcess(
  processId: string,
): Promise<string | null> {
  const row = await prisma.vehicleProcess.findUnique({
    where: { processId },
    select: { vehicle: { select: { registrationNumber: true } } },
  });
  return row?.vehicle?.registrationNumber ?? null;
}

/**
 * Loads a vehicle process with vehicle, persons, references, and upload rows for detail view.
 *
 * @param processId - Vehicle process UUID.
 */
export async function findVehicleProcessDetailsById(
  processId: string,
): Promise<VehicleProcessDetailsRow | null> {
  // `findFirst` + `deletedAt: null` so a binned process's detail view 404s (see findVehicleProcessById).
  return prisma.vehicleProcess.findFirst({
    where: { processId, deletedAt: null },
    include: {
      vehicle: true,
      persons: true,
      processReferences: {
        include: { reference: true },
        orderBy: { createdAt: 'asc' },
      },
      processUploadPhotos: {
        orderBy: { createdAt: 'asc' },
        include: { person: { select: { status: true, personType: true } } },
      },
      processUploadImages: {
        include: {
          dealerWiseUploadCategory: {
            include: { uploadCategory: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      processTags: processTagsSelect,
    },
  });
}

export async function updateVehicleProcess(
  processId: string,
  data: UpdateVehicleProcessData,
): Promise<VehicleProcessWithPersons> {
  return prisma.$transaction(async (tx) => {
    // Only full-replace persons when the caller provided them. Omitting `persons` leaves the
    // process's persons — including CANCELLED buyers (history) and their linked ID photos —
    // intact, so a status- or price-only update never disturbs the buyer lifecycle.
    if (data.persons) {
      await tx.person.deleteMany({ where: { processId } });
    }
    return tx.vehicleProcess.update({
      where: { processId },
      data: {
        vehicleId: data.vehicleId,
        dealerId: data.dealerId,
        processDate: data.processDate,
        purchasePrice: data.purchasePrice ?? null,
        salePrice: data.salePrice ?? null,
        ...(data.priceCurrency ? { priceCurrency: data.priceCurrency } : {}),
        ...(data.persons
          ? {
              persons: {
                create: data.persons.map((p) => ({
                  personName: p.personName,
                  address: p.address ?? null,
                  mobileNumber: p.mobileNumber,
                  personType: p.personType,
                })),
              },
            }
          : {}),
      },
      include: { persons: true },
    });
  });
}

/**
 * Hard-deletes a process and cascades to ALL its children (persons, docs, photos, tasks, expenses,
 * tags, references, comments, assignments — every child relation is `onDelete: Cascade`). Used only by
 * the permanent-delete + purge flows; the routine DELETE now soft-deletes instead.
 *
 * @param processId - Vehicle process UUID.
 */
export async function deleteVehicleProcess(processId: string): Promise<VehicleProcess> {
  return prisma.vehicleProcess.delete({
    where: { processId },
  });
}

/**
 * Soft-deletes a process by stamping `deletedAt = now` (moves it to the recycle bin). Children stay in
 * the DB, hidden by the active-process filters, and return intact on {@link restoreVehicleProcess}.
 *
 * @param processId - Vehicle process UUID.
 */
export async function softDeleteVehicleProcess(processId: string): Promise<VehicleProcess> {
  return prisma.vehicleProcess.update({
    where: { processId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Restores a soft-deleted process by clearing `deletedAt` (`null` = active). Its children were never
 * removed, so the process reappears whole across every active-process query.
 *
 * @param processId - Vehicle process UUID.
 */
export async function restoreVehicleProcess(processId: string): Promise<VehicleProcess> {
  return prisma.vehicleProcess.update({
    where: { processId },
    data: { deletedAt: null },
  });
}

/** A recycle-bin row: the process plus its vehicle registration + persons (to show a seller/owner name). */
export type BinProcessRow = VehicleProcess & {
  vehicle: { registrationNumber: string } | null;
  persons: Person[];
};

/**
 * Lists a dealer's binned (soft-deleted) processes, newest deletion first, with the vehicle
 * registration + persons for display and a matching total for pagination. Pass `null`/`undefined`
 * `dealerId` (super-admin) to list every dealer's binned processes.
 *
 * @param dealerId - Dealer scope, or `null`/`undefined` for all dealers (super-admin).
 * @param skip - Pagination offset.
 * @param take - Page size.
 */
export async function listBinProcessesForDealer(
  dealerId: string | null | undefined,
  skip: number,
  take: number,
): Promise<{ items: BinProcessRow[]; total: number }> {
  const where: Prisma.VehicleProcessWhereInput = {
    deletedAt: { not: null },
    ...(dealerId ? { dealerId: { equals: dealerId } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.vehicleProcess.findMany({
      where,
      skip,
      take,
      orderBy: { deletedAt: 'desc' },
      include: { vehicle: { select: { registrationNumber: true } }, persons: true },
    }),
    prisma.vehicleProcess.count({ where }),
  ]);
  return { items, total };
}

/**
 * Lists an agent's own binned (soft-deleted) processes across ALL placeholder dealers they own
 * (`dealer.isPlaceholder && dealer.ownerAgentId === agentId`), newest deletion first, with the
 * vehicle registration + persons for display and a matching total for pagination. The agent-global
 * counterpart of {@link listBinProcessesForDealer} (mirrors {@link listProcessesForAgentBoard}).
 *
 * @param agentId - The owning agent (from the caller's token).
 * @param skip - Pagination offset.
 * @param take - Page size.
 */
export async function listBinProcessesForAgent(
  agentId: string,
  skip: number,
  take: number,
): Promise<{ items: BinProcessRow[]; total: number }> {
  const where: Prisma.VehicleProcessWhereInput = {
    deletedAt: { not: null },
    dealer: { isPlaceholder: true, ownerAgentId: agentId },
  };
  const [items, total] = await Promise.all([
    prisma.vehicleProcess.findMany({
      where,
      skip,
      take,
      orderBy: { deletedAt: 'desc' },
      include: { vehicle: { select: { registrationNumber: true } }, persons: true },
    }),
    prisma.vehicleProcess.count({ where }),
  ]);
  return { items, total };
}

/** A purge candidate: the process id + its vehicle registration, to compute the upload-folder prefix. */
export interface PurgeCandidate {
  processId: string;
  registrationNumber: string | null;
}

/**
 * Lists every process soft-deleted before `cutoff` (the 7-day purge candidates) with just its id and
 * vehicle registration — enough to compute each one's per-process upload folder prefix so the purge can
 * clean the files off disk. Must be fetched BEFORE {@link hardDeleteExpiredProcessById} removes the
 * rows (the vehicle link is gone afterwards).
 *
 * @param cutoff - Any process with `deletedAt` strictly before this is a purge candidate.
 */
export async function findProcessesToPurge(cutoff: Date): Promise<PurgeCandidate[]> {
  const rows = await prisma.vehicleProcess.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { processId: true, vehicle: { select: { registrationNumber: true } } },
  });
  return rows.map((row) => ({
    processId: row.processId,
    registrationNumber: row.vehicle?.registrationNumber ?? null,
  }));
}

/**
 * Atomically hard-deletes ONE process only if it is still expired (soft-deleted before `cutoff`),
 * cascading to all children — the per-row unit of the 7-day recycle-bin purge. The `deletedAt` guard
 * closes the purge TOCTOU race: if the process was restored (`deletedAt` cleared) between the candidate
 * scan and this call, it matches 0 rows and is left untouched, so its upload folder is not cleaned.
 *
 * @param processId - The candidate process UUID.
 * @param cutoff - The row is only deleted if its `deletedAt` is non-null and strictly before this.
 * @returns The number of rows deleted: `1` if it was still expired, `0` otherwise.
 */
export async function hardDeleteExpiredProcessById(
  processId: string,
  cutoff: Date,
): Promise<number> {
  const result = await prisma.vehicleProcess.deleteMany({
    where: { processId, deletedAt: { not: null, lt: cutoff } },
  });
  return result.count;
}

/**
 * Sets (or clears) a process's RTO receipt file + upload timestamp.
 *
 * @param processId - Vehicle process UUID.
 * @param receiptImageName - Folder-scoped storage key, or `null` to clear.
 * @param receiptUploadedAt - Upload time, or `null` when clearing.
 */
export async function updateProcessReceipt(
  processId: string,
  receiptImageName: string | null,
  receiptUploadedAt: Date | null,
): Promise<VehicleProcess> {
  return prisma.vehicleProcess.update({
    where: { processId },
    data: { receiptImageName, receiptUploadedAt },
  });
}

/**
 * Sets (or clears) a process's fixed lifecycle status. `null` returns the process to OPEN; the
 * open-uniqueness invariant is enforced by the service before this call.
 *
 * @param processId - Vehicle process UUID.
 * @param status - A terminal status (SOLD/COMPLETE/SCRAP), or `null` to clear back to open.
 */
export async function updateVehicleProcessStatus(
  processId: string,
  status: VehicleProcessStatus | null,
  soldDate?: Date | null,
): Promise<VehicleProcess> {
  return prisma.vehicleProcess.update({
    where: { processId },
    // Leave soldDate untouched unless the caller passes it (e.g. when transitioning into SOLD).
    data: soldDate === undefined ? { status } : { status, soldDate },
  });
}

/** Sets a process's recorded sold date (manual edit of an already-sold process). */
export async function updateVehicleProcessSoldDate(
  processId: string,
  soldDate: Date,
): Promise<VehicleProcess> {
  return prisma.vehicleProcess.update({
    where: { processId },
    data: { soldDate },
  });
}

/**
 * Sets (or clears) a process's RC-book post/courier tracking number.
 *
 * @param processId - Vehicle process UUID.
 * @param trackingNumber - Tracking number, or `null` to clear.
 */
export async function updateProcessTrackingNumber(
  processId: string,
  trackingNumber: string | null,
): Promise<VehicleProcess> {
  return prisma.vehicleProcess.update({
    where: { processId },
    data: { trackingNumber },
  });
}

/**
 * Lists an agent's own (agent-created) processes for the agent board: every process on a placeholder
 * dealer the agent owns, with its vehicle registration, source dealer summary, and agent-kanban
 * status. Connected placeholders' processes have already been re-pointed to the real dealer, so this
 * naturally returns only still-agent-owned work. Newest first.
 *
 * @param agentId - The owning agent (from the caller's token).
 */
export async function listProcessesForAgentBoard(
  agentId: string,
): Promise<AgentBoardProcessRow[]> {
  return prisma.vehicleProcess.findMany({
    // `deletedAt: null` keeps binned processes off the agent board.
    where: { deletedAt: null, dealer: { isPlaceholder: true, ownerAgentId: agentId } },
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle: { select: { registrationNumber: true } },
      dealer: { select: { dealerId: true, firmName: true } },
      agentStatus: { select: { statusId: true, statusName: true, colour: true } },
      processTags: processTagsSelect,
    },
  });
}

/**
 * Moves an agent-created process into one of the agent's own kanban columns (`agentStatusId`).
 * Ownership + status validity are enforced by the service before this call.
 *
 * @param processId - Vehicle process UUID.
 * @param agentStatusId - Target agent status UUID.
 */
export async function updateProcessAgentStatus(
  processId: string,
  agentStatusId: string,
): Promise<VehicleProcess> {
  return prisma.vehicleProcess.update({
    where: { processId },
    data: { agentStatusId },
  });
}

/**
 * Returns EVERY non-null `receiptImageName` object key across all processes, regardless of `deletedAt`
 * (soft-deleted processes still own their RTO receipt files). Feeds the orphan-root-upload sweep's
 * referenced-key set so a receipt that (rarely) failed to relocate and is still flat in the root is
 * never deleted.
 */
export async function findAllReceiptImageNames(): Promise<string[]> {
  const rows = await prisma.vehicleProcess.findMany({
    where: { receiptImageName: { not: null } },
    select: { receiptImageName: true },
  });
  return rows
    .map((row) => row.receiptImageName)
    .filter((name): name is string => name !== null);
}

