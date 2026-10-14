import { StatusCodes } from 'http-status-codes';
import type { Prisma, Vehicle } from '@prisma/client';
import * as vehicleRepository from '../repositories/vehicle.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';
import type { CreateVehicleData } from '../repositories/vehicle.repository';

/**
 * Canonicalizes a registration number for storage AND lookup so one physical vehicle can't split
 * across rows: trims, uppercases, and strips spaces/hyphens (e.g. "mh 12-ab 1234" → "MH12AB1234").
 */
export function normalizeRegistrationNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '');
}

/**
 * Input for creating a new vehicle. `registrationNumber` is required and unique;
 * `chassisNumber` and `engineNumber` must be unique when provided (non-null).
 */
export interface CreateVehicleInput {
  registrationNumber: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  vehicleType: string | null;
  make: string | null;
  model: string | null;
  registrationDate: string | null;
  manufactureMonth: number | null;
  manufactureYear: number | null;
}

/**
 * Input for updating an existing vehicle. Same rules as create.
 */
export interface UpdateVehicleInput extends CreateVehicleInput {}

/**
 * Parses a validated date-only string into `Date`, or returns `null`.
 */
const toRegistrationDate = (value: string | null): Date | null => {
  if (value === null) return null;
  return new Date(value);
};

/**
 * Maps API input to persisted vehicle shape.
 */
const inputToVehicleData = (input: CreateVehicleInput): CreateVehicleData => ({
  registrationNumber: input.registrationNumber.trim(),
  chassisNumber: input.chassisNumber,
  engineNumber: input.engineNumber,
  vehicleType: input.vehicleType,
  make: input.make,
  model: input.model,
  registrationDate: toRegistrationDate(input.registrationDate),
  manufactureMonth: input.manufactureMonth,
  manufactureYear: input.manufactureYear,
});

/**
 * Maps a DB row to the same shape used for comparisons.
 */
const vehicleRowToData = (v: Vehicle): CreateVehicleData => ({
  registrationNumber: v.registrationNumber,
  chassisNumber: v.chassisNumber,
  engineNumber: v.engineNumber,
  vehicleType: v.vehicleType,
  make: v.make,
  model: v.model,
  registrationDate: v.registrationDate,
  manufactureMonth: v.manufactureMonth,
  manufactureYear: v.manufactureYear,
});

const optionalStrEqual = (a: string | null, b: string | null): boolean => {
  const na = a === null || a === undefined ? null : a.trim() || null;
  const nb = b === null || b === undefined ? null : b.trim() || null;
  return na === nb;
};

/**
 * Compares calendar dates in UTC (ignores time); both null counts as equal.
 */
const registrationDatesEqual = (a: Date | null, b: Date | null): boolean => {
  if (a === null && b === null) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  const da = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
  const db = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
  return da.getTime() === db.getTime();
};

/**
 * Returns whether mutable vehicle attributes (excluding PK) already match `incoming`.
 */
const vehicleDetailsMatch = (existing: Vehicle, incoming: CreateVehicleData): boolean => {
  const a = vehicleRowToData(existing);
  return (
    optionalStrEqual(a.chassisNumber, incoming.chassisNumber) &&
    optionalStrEqual(a.engineNumber, incoming.engineNumber) &&
    optionalStrEqual(a.vehicleType, incoming.vehicleType) &&
    optionalStrEqual(a.make, incoming.make) &&
    optionalStrEqual(a.model, incoming.model) &&
    registrationDatesEqual(a.registrationDate, incoming.registrationDate) &&
    a.manufactureMonth === incoming.manufactureMonth &&
    a.manufactureYear === incoming.manufactureYear
  );
};

/**
 * If `registrationNumber` is new, creates a vehicle. If it exists and detail fields differ, updates
 * the row. If it exists and all compared fields match, returns the existing row unchanged.
 *
 * @param input - Validated vehicle fields from the API.
 */
export async function upsertVehicleByRegistrationNumber(
  input: CreateVehicleInput,
): Promise<{ vehicle: Vehicle; created: boolean; updated: boolean }> {
  const trimmedInput: CreateVehicleInput = {
    ...input,
    registrationNumber: normalizeRegistrationNumber(input.registrationNumber),
  };
  const incomingData = inputToVehicleData(trimmedInput);

  const existing = await vehicleRepository.findVehicleByRegistrationNumber(
    incomingData.registrationNumber,
  );

  if (!existing) {
    const vehicle = await createVehicle(trimmedInput);
    return { vehicle, created: true, updated: false };
  }

  if (vehicleDetailsMatch(existing, incomingData)) {
    return { vehicle: existing, created: false, updated: false };
  }

  const vehicle = await updateVehicle(existing.vehicleId, trimmedInput);
  return { vehicle, created: false, updated: true };
}

/**
 * Creates a new vehicle. Throws if registrationNumber is duplicated, or if a non-null
 * chassisNumber / engineNumber matches another vehicle.
 */
export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const registrationNumber = normalizeRegistrationNumber(input.registrationNumber);
  const existingByReg =
    await vehicleRepository.findVehicleByRegistrationNumber(registrationNumber);
  if (existingByReg) {
    throw new AppError(
      'Registration number already exists',
      StatusCodes.CONFLICT,
      4100,
    );
  }

  if (input.chassisNumber) {
    const existingByChassis =
      await vehicleRepository.findVehicleByChassisNumber(input.chassisNumber);
    if (existingByChassis) {
      throw new AppError(
        'Chassis number already exists',
        StatusCodes.CONFLICT,
        4101,
      );
    }
  }

  if (input.engineNumber) {
    const existingByEngine =
      await vehicleRepository.findVehicleByEngineNumber(input.engineNumber);
    if (existingByEngine) {
      throw new AppError(
        'Engine number already exists',
        StatusCodes.CONFLICT,
        4102,
      );
    }
  }

  return vehicleRepository.createVehicle({
    registrationNumber,
    chassisNumber: input.chassisNumber,
    engineNumber: input.engineNumber,
    vehicleType: input.vehicleType,
    make: input.make,
    model: input.model,
    registrationDate: toRegistrationDate(input.registrationDate),
    manufactureMonth: input.manufactureMonth,
    manufactureYear: input.manufactureYear,
  });
}

/**
 * Returns a paginated list of vehicles.
 */
export async function listVehicles(
  query: PaginationQuery,
): Promise<PaginatedResult<Vehicle>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await vehicleRepository.listVehicles(skip, take);
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

/**
 * Retrieves a single vehicle by ID, or throws if not found.
 */
export async function getVehicleById(vehicleId: string): Promise<Vehicle> {
  const vehicle = await vehicleRepository.findVehicleById(vehicleId);
  if (!vehicle) {
    throw new AppError('Vehicle not found', StatusCodes.NOT_FOUND, 4047);
  }
  return vehicle;
}

/**
 * Updates an existing vehicle. Uniqueness rules for registrationNumber and non-null
 * chassisNumber / engineNumber are enforced.
 */
export async function updateVehicle(
  vehicleId: string,
  input: UpdateVehicleInput,
): Promise<Vehicle> {
  await getVehicleById(vehicleId);

  const registrationNumber = normalizeRegistrationNumber(input.registrationNumber);
  const existingByReg =
    await vehicleRepository.findVehicleByRegistrationNumber(
      registrationNumber,
      vehicleId,
    );
  if (existingByReg) {
    throw new AppError(
      'Registration number already exists',
      StatusCodes.CONFLICT,
      4100,
    );
  }

  if (input.chassisNumber) {
    const existingByChassis =
      await vehicleRepository.findVehicleByChassisNumber(
        input.chassisNumber,
        vehicleId,
      );
    if (existingByChassis) {
      throw new AppError(
        'Chassis number already exists',
        StatusCodes.CONFLICT,
        4101,
      );
    }
  }

  if (input.engineNumber) {
    const existingByEngine =
      await vehicleRepository.findVehicleByEngineNumber(
        input.engineNumber,
        vehicleId,
      );
    if (existingByEngine) {
      throw new AppError(
        'Engine number already exists',
        StatusCodes.CONFLICT,
        4102,
      );
    }
  }

  return vehicleRepository.updateVehicle(vehicleId, {
    registrationNumber,
    chassisNumber: input.chassisNumber,
    engineNumber: input.engineNumber,
    vehicleType: input.vehicleType,
    make: input.make,
    model: input.model,
    registrationDate: toRegistrationDate(input.registrationDate),
    manufactureMonth: input.manufactureMonth,
    manufactureYear: input.manufactureYear,
  });
}

/**
 * Deletes a vehicle by ID.
 */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  await getVehicleById(vehicleId);
  await vehicleRepository.deleteVehicle(vehicleId);
}

/** A single buy/sell event in the caller's own per-vehicle history. */
export interface VehicleHistoryEvent {
  kind: 'BUY' | 'SELL';
  date: Date | null;
  counterpartyName: string;
  counterpartyMobile: string;
  counterpartyAddress: string | null;
  amount: number | null;
  currency: string;
  processId: string;
  /** Referrer name for this side of the deal (null = direct, shown as "Self" in the UI). */
  referenceName: string | null;
}

/** Per-vehicle history: own events + own summary + an anonymized cross-dealer market signal. */
export interface VehicleHistoryDto {
  vehicle: {
    vehicleId: string;
    registrationNumber: string;
    make: string | null;
    model: string | null;
    chassisNumber: string | null;
    engineNumber: string | null;
    manufactureYear: number | null;
  };
  events: VehicleHistoryEvent[];
  summary: {
    processCount: number;
    grossMarginTotal: number | null;
    expenseTotal: number;
    netProfitTotal: number | null;
    currency: string;
  };
  market: vehicleProcessRepository.VehicleMarketSignal;
}

/**
 * Builds the per-vehicle buy/sell history for ONE dealer (own data only) plus an anonymized
 * cross-dealer "changed hands" signal. The caller must have handled the vehicle (≥1 own process),
 * else 404 — so this is not a cross-dealer existence oracle. Prices come only from the caller's
 * own processes; the market signal carries no price/PII/dealer identity.
 *
 * @param dealerId - The caller's resolved dealer.
 * @param registrationNumber - Reg number to look up (normalized).
 */
export async function getVehicleHistory(
  dealerId: string,
  registrationNumber: string,
): Promise<VehicleHistoryDto> {
  const vehicle = await vehicleRepository.findVehicleByRegistrationNumber(
    normalizeRegistrationNumber(registrationNumber),
  );
  if (!vehicle) {
    throw new AppError('Vehicle not found', StatusCodes.NOT_FOUND, 4047);
  }
  const processes = await vehicleProcessRepository.listProcessesForVehicleByDealer(
    vehicle.vehicleId,
    dealerId,
  );
  if (processes.length === 0) {
    // The dealer has never handled this vehicle — do not reveal it exists for others.
    throw new AppError('Vehicle not found', StatusCodes.NOT_FOUND, 4047);
  }

  const currency = processes.find((p) => p.priceCurrency)?.priceCurrency ?? 'INR';
  const events: VehicleHistoryEvent[] = [];
  let marginTotal: Prisma.Decimal | null = null;
  let expenseTotal: Prisma.Decimal | null = null;

  // The referrer for a side of the deal: a BUY (dealer buys from the seller) carries the SELL-side
  // reference; a SELL (dealer sells to the buyer) carries the BUY-side reference. Null = direct ("Self").
  const referenceNameFor = (
    proc: (typeof processes)[number],
    referenceType: 'SELL' | 'BUY',
  ): string | null =>
    proc.processReferences.find((r) => r.referenceType === referenceType)?.reference?.referenceName ?? null;

  for (const proc of processes) {
    const seller = proc.persons.find((p) => p.personType === 'SELLER') ?? null;
    const buyer = proc.persons.find((p) => p.personType === 'BUYER') ?? null;
    // Emit a BUY iff a SELLER exists (price may be null = "not recorded"); SELL iff a BUYER exists.
    if (seller) {
      events.push({
        kind: 'BUY',
        date: proc.processDate,
        counterpartyName: seller.personName,
        counterpartyMobile: seller.mobileNumber,
        counterpartyAddress: seller.address,
        amount: proc.purchasePrice ? proc.purchasePrice.toNumber() : null,
        currency: proc.priceCurrency ?? 'INR',
        processId: proc.processId,
        referenceName: referenceNameFor(proc, 'SELL'),
      });
    }
    if (buyer) {
      events.push({
        kind: 'SELL',
        date: proc.processDate,
        counterpartyName: buyer.personName,
        counterpartyMobile: buyer.mobileNumber,
        counterpartyAddress: buyer.address,
        amount: proc.salePrice ? proc.salePrice.toNumber() : null,
        currency: proc.priceCurrency ?? 'INR',
        processId: proc.processId,
        referenceName: referenceNameFor(proc, 'BUY'),
      });
    }
    // Per-process gross margin only when BOTH prices exist; Decimal math before any toNumber.
    if (proc.purchasePrice && proc.salePrice) {
      const m = proc.salePrice.sub(proc.purchasePrice);
      marginTotal = marginTotal ? marginTotal.add(m) : m;
    }
    // Sum the caller's own expenses across all their processes for this vehicle (Decimal math).
    for (const expense of proc.processExpenses) {
      expenseTotal = expenseTotal ? expenseTotal.add(expense.amount) : expense.amount;
    }
  }

  // Net profit = gross margin − expenses, but only when a gross margin exists (needs both prices).
  const netProfitTotal =
    marginTotal !== null ? (expenseTotal ? marginTotal.sub(expenseTotal) : marginTotal).toNumber() : null;

  // Stable timeline order: date asc (NULLS already last from the query), then kind BUY < SELL.
  const kindRank = (k: 'BUY' | 'SELL'): number => (k === 'BUY' ? 0 : 1);
  events.sort((a, b) => {
    const at = a.date ? a.date.getTime() : Number.POSITIVE_INFINITY;
    const bt = b.date ? b.date.getTime() : Number.POSITIVE_INFINITY;
    return at !== bt ? at - bt : kindRank(a.kind) - kindRank(b.kind);
  });

  const market = await vehicleProcessRepository.getVehicleMarketSignal(vehicle.vehicleId);

  return {
    vehicle: {
      vehicleId: vehicle.vehicleId,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      chassisNumber: vehicle.chassisNumber,
      engineNumber: vehicle.engineNumber,
      manufactureYear: vehicle.manufactureYear,
    },
    events,
    summary: {
      processCount: processes.length,
      grossMarginTotal: marginTotal ? marginTotal.toNumber() : null,
      expenseTotal: expenseTotal ? expenseTotal.toNumber() : 0,
      netProfitTotal,
      currency,
    },
    market,
  };
}
