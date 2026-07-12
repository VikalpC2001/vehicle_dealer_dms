import { prisma } from '../config/prisma';
import type {
  PersonType,
  VehicleProcess,
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
} from '@prisma/client';

export type VehicleProcessWithPersons = VehicleProcess & { persons: Person[] };

/** A process with its persons AND booked expenses — used to build per-vehicle history + net profit. */
export type VehicleProcessWithPersonsAndExpenses = VehicleProcessWithPersons & {
  processExpenses: ProcessExpense[];
};

/** List row: persons plus the vehicle (for showing the vehicle/registration number). */
export type VehicleProcessListItem = VehicleProcess & {
  persons: Person[];
  vehicle: Vehicle | null;
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

export type VehicleProcessDetailsRow = VehicleProcess & {
  vehicle: Vehicle | null;
  persons: Person[];
  processReferences: ProcessReferenceWithDealerReference[];
  processUploadPhotos: ProcessUploadPhoto[];
  processUploadImages: ProcessUploadImageWithCategory[];
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
  vehicleId: string;
  dealerId: string;
  status: string;
  processDate: Date;
  persons: PersonInputData[];
  purchasePrice?: number | null;
  salePrice?: number | null;
  priceCurrency?: string | null;
  uploadPhotos?: StartUploadPhotoInputData[];
  processReferences?: StartProcessReferenceInputData[];
}

export interface UpdateVehicleProcessData {
  vehicleId: string;
  dealerId: string;
  status: string;
  processDate: Date;
  persons: PersonInputData[];
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
      vehicleId: data.vehicleId,
      dealerId: data.dealerId,
      status: data.status,
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
): Promise<{ items: VehicleProcessListItem[]; total: number }> {
  // Dealer-scoped when a dealerId is given (non-admin); `{ equals }` is null-safe.
  const where = dealerId ? { dealerId: { equals: dealerId } } : {};
  const [items, total] = await Promise.all([
    prisma.vehicleProcess.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { persons: true, vehicle: true },
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
      },
      processUploadImages: {
        include: {
          dealerWiseUploadCategory: {
            include: { uploadCategory: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function updateVehicleProcess(
  processId: string,
  data: UpdateVehicleProcessData,
): Promise<VehicleProcessWithPersons> {
  return prisma.$transaction(async (tx) => {
    await tx.person.deleteMany({ where: { processId } });
    return tx.vehicleProcess.update({
      where: { processId },
      data: {
        vehicleId: data.vehicleId,
        dealerId: data.dealerId,
        status: data.status,
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

