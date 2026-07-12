import { prisma } from '../config/prisma';
import type { Vehicle } from '@prisma/client';

/**
 * Data required to create a new vehicle. `registrationNumber` is required and unique;
 * `chassisNumber` and `engineNumber` are unique when non-null.
 */
export interface CreateVehicleData {
  registrationNumber: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  vehicleType: string | null;
  make: string | null;
  model: string | null;
  registrationDate: Date | null;
  manufactureMonth: number | null;
  manufactureYear: number | null;
}

/**
 * Data allowed when updating an existing vehicle. Same rules as create.
 */
export interface UpdateVehicleData extends CreateVehicleData {}

/**
 * Creates a new vehicle.
 */
export async function createVehicle(data: CreateVehicleData): Promise<Vehicle> {
  return prisma.vehicle.create({
    data,
  });
}

/**
 * Returns a paginated list of vehicles and total count.
 */
export async function listVehicles(
  skip: number,
  take: number,
): Promise<{ items: Vehicle[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vehicle.count(),
  ]);
  return { items, total };
}

/**
 * Finds a single vehicle by ID.
 */
export async function findVehicleById(vehicleId: string): Promise<Vehicle | null> {
  return prisma.vehicle.findUnique({
    where: { vehicleId },
  });
}

/**
 * Finds a vehicle by registrationNumber. Optionally exclude a vehicleId (for update uniqueness check).
 */
export async function findVehicleByRegistrationNumber(
  registrationNumber: string,
  excludeVehicleId?: string,
): Promise<Vehicle | null> {
  return prisma.vehicle.findFirst({
    where: {
      registrationNumber,
      ...(excludeVehicleId && { vehicleId: { not: excludeVehicleId } }),
    },
  });
}

/**
 * Finds a vehicle by chassisNumber. Optionally exclude a vehicleId (for update uniqueness check).
 */
export async function findVehicleByChassisNumber(
  chassisNumber: string,
  excludeVehicleId?: string,
): Promise<Vehicle | null> {
  return prisma.vehicle.findFirst({
    where: {
      chassisNumber,
      ...(excludeVehicleId && { vehicleId: { not: excludeVehicleId } }),
    },
  });
}

/**
 * Finds a vehicle by engineNumber. Optionally exclude a vehicleId (for update uniqueness check).
 */
export async function findVehicleByEngineNumber(
  engineNumber: string,
  excludeVehicleId?: string,
): Promise<Vehicle | null> {
  return prisma.vehicle.findFirst({
    where: {
      engineNumber,
      ...(excludeVehicleId && { vehicleId: { not: excludeVehicleId } }),
    },
  });
}

/**
 * Updates an existing vehicle.
 */
export async function updateVehicle(
  vehicleId: string,
  data: UpdateVehicleData,
): Promise<Vehicle> {
  return prisma.vehicle.update({
    where: { vehicleId },
    data,
  });
}

/**
 * Deletes a vehicle by ID.
 */
export async function deleteVehicle(vehicleId: string): Promise<Vehicle> {
  return prisma.vehicle.delete({
    where: { vehicleId },
  });
}
