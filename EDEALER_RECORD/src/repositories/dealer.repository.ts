import { prisma } from '../config/prisma';
import type { Dealer } from '@prisma/client';

/**
 * Data required to create a new dealer. All fields are required; emailId, mobileNo, and whatsappNo must be unique.
 */
export interface CreateDealerData {
  firmName: string;
  dealerName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mobileNo: string;
  emailId: string;
  displayName: string;
  whatsappNo: string;
  isSubscribe?: boolean;
}

/**
 * Data allowed when updating a dealer. All fields required; emailId, mobileNo, and whatsappNo must be unique (excluding current dealer).
 */
export interface UpdateDealerData {
  firmName: string;
  dealerName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mobileNo: string;
  emailId: string;
  displayName: string;
  whatsappNo: string;
  isSubscribe: boolean;
}

/** Default statuses created for each new dealer. */
const DEFAULT_DEALER_STATUSES: ReadonlyArray<{
  statusName: string;
  colour: string;
  statusRank: number;
}> = [
  { statusName: 'TO-DO', colour: '#3b82f6', statusRank: 1 },
  { statusName: 'In Progress', colour: '#eab308', statusRank: 2 },
  { statusName: 'Complete', colour: '#22c55e', statusRank: 3 },
];

/**
 * Creates a new dealer and three default statuses (TO-DO, In Progress, Complete) for that dealer.
 */
export async function createDealer(data: CreateDealerData): Promise<Dealer> {
  return prisma.$transaction(async (tx) => {
    const dealer = await tx.dealer.create({
      data: {
        firmName: data.firmName,
        dealerName: data.dealerName,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        mobileNo: data.mobileNo,
        emailId: data.emailId,
        displayName: data.displayName,
        whatsappNo: data.whatsappNo,
        isSubscribe: data.isSubscribe ?? false,
      },
    });
    await tx.dealerStatus.createMany({
      data: DEFAULT_DEALER_STATUSES.map((s) => ({
        dealerId: dealer.dealerId,
        statusName: s.statusName,
        colour: s.colour,
        statusRank: s.statusRank,
      })),
    });
    return dealer;
  });
}

/**
 * Returns a paginated list of dealers and total count.
 */
export async function listDealers(
  skip: number,
  take: number,
): Promise<{ items: Dealer[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.dealer.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dealer.count(),
  ]);
  return { items, total };
}

/**
 * Finds a single dealer by ID.
 */
export async function findDealerById(dealerId: string): Promise<Dealer | null> {
  return prisma.dealer.findUnique({
    where: { dealerId },
  });
}

/**
 * Finds a dealer by emailId. Optionally exclude a dealer ID (for update uniqueness check).
 */
export async function findDealerByEmailId(
  emailId: string,
  excludeDealerId?: string,
): Promise<Dealer | null> {
  return prisma.dealer.findFirst({
    where: {
      emailId,
      ...(excludeDealerId && { dealerId: { not: excludeDealerId } }),
    },
  });
}

/**
 * Finds a dealer by mobileNo. Optionally exclude a dealer ID (for update uniqueness check).
 */
export async function findDealerByMobileNo(
  mobileNo: string,
  excludeDealerId?: string,
): Promise<Dealer | null> {
  return prisma.dealer.findFirst({
    where: {
      mobileNo,
      ...(excludeDealerId && { dealerId: { not: excludeDealerId } }),
    },
  });
}

/**
 * Finds a dealer by whatsappNo. Optionally exclude a dealer ID (for update uniqueness check).
 */
export async function findDealerByWhatsappNo(
  whatsappNo: string,
  excludeDealerId?: string,
): Promise<Dealer | null> {
  return prisma.dealer.findFirst({
    where: {
      whatsappNo,
      ...(excludeDealerId && { dealerId: { not: excludeDealerId } }),
    },
  });
}

/**
 * Updates an existing dealer.
 */
export async function updateDealer(
  dealerId: string,
  data: UpdateDealerData,
): Promise<Dealer> {
  return prisma.dealer.update({
    where: { dealerId },
    data,
  });
}

/**
 * Deletes a dealer by ID.
 */
export async function deleteDealer(dealerId: string): Promise<Dealer> {
  return prisma.dealer.delete({
    where: { dealerId },
  });
}
