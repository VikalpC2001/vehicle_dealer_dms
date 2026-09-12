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
): Promise<{ items: VehicleProcessListItem[]; total: number }> {
  // Dealer-scoped when a dealerId is given (non-admin); `{ equals }` is null-safe.
  const where: Prisma.VehicleProcessWhereInput = dealerId ? { dealerId: { equals: dealerId } } : {};
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
      include: { persons: true, vehicle: true, processTags: processTagsSelect },
    }),
    prisma.vehicleProcess.count({ where }),
  ]);
  return { items, total };
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
    where: { vehicleId, dealerId: { equals: dealerId } },
    include: { persons: true, processExpenses: true },
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
      where: { vehicleId, persons: { some: { personType: 'BUYER' } } },
    }),
    prisma.vehicleProcess.findMany({
      where: { vehicleId, dealerId: { not: null } },
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
  return prisma.vehicleProcess.findUnique({
    where: { processId },
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

export async function deleteVehicleProcess(processId: string): Promise<VehicleProcess> {
  return prisma.vehicleProcess.delete({
    where: { processId },
  });
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
): Promise<VehicleProcess> {
  return prisma.vehicleProcess.update({
    where: { processId },
    data: { status },
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
    where: { dealer: { isPlaceholder: true, ownerAgentId: agentId } },
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

