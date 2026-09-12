import { prisma } from '../config/prisma';
import type { ApprovalStatus, Dealer } from '@prisma/client';

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
  approvalStatus?: ApprovalStatus;
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

/**
 * Creates a new dealer.
 */
export async function createDealer(data: CreateDealerData): Promise<Dealer> {
  return prisma.dealer.create({
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
      approvalStatus: data.approvalStatus,
    },
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
 * Sets a dealer's active-agent slot limit (`maxAgents`). The single write behind the
 * "raise agent slots" flow (super-admin today; a future self-serve addon reuses it).
 */
export async function setMaxAgents(dealerId: string, maxAgents: number): Promise<Dealer> {
  return prisma.dealer.update({
    where: { dealerId },
    data: { maxAgents },
  });
}

/** Sets a dealer's subscription flag (super-admin subscription management). */
export async function setDealerSubscription(
  dealerId: string,
  isSubscribe: boolean,
): Promise<Dealer> {
  return prisma.dealer.update({
    where: { dealerId },
    data: { isSubscribe },
  });
}

/**
 * Sets a dealer's self-registration approval state (and optional reason for a rejection).
 *
 * @param dealerId - Dealer id.
 * @param approvalStatus - New approval state.
 * @param approvalReason - Reason (kept for REJECTED; pass null to clear).
 */
export async function setDealerApproval(
  dealerId: string,
  approvalStatus: ApprovalStatus,
  approvalReason: string | null,
): Promise<Dealer> {
  return prisma.dealer.update({
    where: { dealerId },
    data: { approvalStatus, approvalReason },
  });
}

/**
 * Lists dealers whose approval is in the given states (newest first) — the super-admin request
 * queue. Only dealers with a **verified** linked login are returned, so abandoned self-registrations
 * (email never confirmed) don't clutter the queue.
 *
 * @param statuses - Approval states to include (e.g. PENDING, REJECTED).
 */
export async function listDealersByApprovalStatuses(statuses: ApprovalStatus[]): Promise<Dealer[]> {
  return prisma.dealer.findMany({
    where: {
      approvalStatus: { in: statuses },
      dealerWiseUsers: { some: { user: { emailVerified: true } } },
    },
    orderBy: { createdAt: 'desc' },
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
