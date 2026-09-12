import { prisma } from '../config/prisma';
import { DealerAgentSource, DealerAgentStatus } from '@prisma/client';
import type { Dealer, DealerAgent } from '@prisma/client';

/**
 * Data required to create a placeholder dealer. A placeholder is a name-only
 * `Dealer` row owned by an agent; all contact/address fields are null.
 */
export interface CreatePlaceholderDealerData {
  ownerAgentId: string;
  firmName: string;
  dealerName: string;
  displayName: string;
}

/**
 * Data allowed when updating a placeholder dealer. Only the name fields may change.
 */
export interface UpdatePlaceholderDealerData {
  firmName?: string;
  dealerName?: string;
  displayName?: string;
}

/** A placeholder dealer with its connected real dealer summary (if any). */
export type PlaceholderDealerWithConnection = Dealer & {
  connectedDealer: Pick<Dealer, 'dealerId' | 'firmName' | 'dealerName'> | null;
};

/** Selection of the connected dealer summary surfaced on a placeholder. */
const connectedDealerSelect = {
  select: { dealerId: true, firmName: true, dealerName: true },
} as const;

/**
 * Creates a placeholder dealer owned by the given agent. Sets `isPlaceholder: true`
 * and leaves all contact/address fields null.
 *
 * @param data - Owner agent id and required name fields.
 * @returns The newly created placeholder dealer row.
 */
export async function createPlaceholderDealer(
  data: CreatePlaceholderDealerData,
): Promise<Dealer> {
  return prisma.dealer.create({
    data: {
      firmName: data.firmName,
      dealerName: data.dealerName,
      displayName: data.displayName,
      isPlaceholder: true,
      ownerAgentId: data.ownerAgentId,
      address: null,
      city: null,
      state: null,
      pincode: null,
      mobileNo: null,
      emailId: null,
      whatsappNo: null,
    },
  });
}

/**
 * Lists all placeholder dealers owned by the given agent, newest first, including
 * a summary of the connected real dealer when present.
 *
 * @param agentId - The owning agent's id.
 * @returns Placeholder dealers with their connected-dealer summary.
 */
export async function listPlaceholderDealersForAgent(
  agentId: string,
): Promise<PlaceholderDealerWithConnection[]> {
  return prisma.dealer.findMany({
    where: { isPlaceholder: true, ownerAgentId: agentId },
    orderBy: { createdAt: 'desc' },
    include: { connectedDealer: connectedDealerSelect },
  });
}

/**
 * Finds a single placeholder dealer by id, including its connected-dealer summary.
 * Returns rows regardless of `isPlaceholder`/owner; scope checks live in the service.
 *
 * @param dealerId - The dealer id to look up.
 * @returns The dealer row (with connection) or null.
 */
export async function findPlaceholderById(
  dealerId: string,
): Promise<PlaceholderDealerWithConnection | null> {
  return prisma.dealer.findUnique({
    where: { dealerId },
    include: { connectedDealer: connectedDealerSelect },
  });
}

/**
 * Updates the name fields of a placeholder dealer and returns the updated row
 * with its connected-dealer summary.
 *
 * @param dealerId - The placeholder dealer id.
 * @param data - The name fields to change.
 * @returns The updated placeholder dealer (with connection).
 */
export async function updatePlaceholderDealer(
  dealerId: string,
  data: UpdatePlaceholderDealerData,
): Promise<PlaceholderDealerWithConnection> {
  return prisma.dealer.update({
    where: { dealerId },
    data: {
      ...(data.firmName !== undefined && { firmName: data.firmName }),
      ...(data.dealerName !== undefined && { dealerName: data.dealerName }),
      ...(data.displayName !== undefined && { displayName: data.displayName }),
    },
    include: { connectedDealer: connectedDealerSelect },
  });
}

/**
 * Deletes a placeholder dealer by id.
 *
 * @param dealerId - The placeholder dealer id.
 * @returns The deleted dealer row.
 */
export async function deletePlaceholderDealer(dealerId: string): Promise<Dealer> {
  return prisma.dealer.delete({
    where: { dealerId },
  });
}

/**
 * Sets or clears the `connectedDealerId` link of a placeholder dealer and returns
 * the updated row with its connected-dealer summary.
 *
 * @param dealerId - The placeholder dealer id.
 * @param connectedDealerId - The real dealer id to link, or null to clear.
 * @returns The updated placeholder dealer (with connection).
 */
export async function setPlaceholderConnection(
  dealerId: string,
  connectedDealerId: string | null,
): Promise<PlaceholderDealerWithConnection> {
  return prisma.dealer.update({
    where: { dealerId },
    data: { connectedDealerId },
    include: { connectedDealer: connectedDealerSelect },
  });
}

/**
 * Counts vehicle processes attached to a dealer. Used as a delete guard so a
 * placeholder with work cannot be removed.
 *
 * @param dealerId - The dealer id.
 * @returns The number of vehicle processes for that dealer.
 */
export async function countProcessesForDealer(dealerId: string): Promise<number> {
  return prisma.vehicleProcess.count({ where: { dealerId } });
}

/**
 * Finds any dealer by id (used to validate a connect target). Returns the raw
 * row so the service can inspect `isPlaceholder` / `isSubscribe`.
 *
 * @param dealerId - The dealer id to look up.
 * @returns The dealer row or null.
 */
export async function findRealDealerById(dealerId: string): Promise<Dealer | null> {
  return prisma.dealer.findUnique({
    where: { dealerId },
  });
}

/**
 * Creates or reactivates a CONNECT grant linking an agent to a real dealer.
 * Upserts on the `dealerId_agentId` unique key, forcing status ACTIVE and
 * source CONNECT (CONNECT grants are excluded from the dealer's agent cap).
 *
 * @param dealerId - The real dealer id being connected to.
 * @param agentId - The agent gaining access.
 * @returns The upserted DealerAgent grant.
 */
export async function upsertConnectGrant(
  dealerId: string,
  agentId: string,
): Promise<DealerAgent> {
  return prisma.dealerAgent.upsert({
    where: { dealerId_agentId: { dealerId, agentId } },
    create: {
      dealerId,
      agentId,
      status: DealerAgentStatus.ACTIVE,
      source: DealerAgentSource.CONNECT,
    },
    update: {
      status: DealerAgentStatus.ACTIVE,
      source: DealerAgentSource.CONNECT,
    },
  });
}

/**
 * Revokes the CONNECT grant between a dealer and an agent, if one exists.
 * No-op when the grant is absent.
 *
 * @param dealerId - The real dealer id previously connected to.
 * @param agentId - The agent whose access is revoked.
 * @returns The updated DealerAgent grant, or null when none existed.
 */
export async function revokeConnectGrant(
  dealerId: string,
  agentId: string,
): Promise<DealerAgent | null> {
  const grant = await prisma.dealerAgent.findUnique({
    where: { dealerId_agentId: { dealerId, agentId } },
  });
  if (!grant) {
    return null;
  }
  return prisma.dealerAgent.update({
    where: { dealerId_agentId: { dealerId, agentId } },
    data: { status: DealerAgentStatus.REVOKED },
  });
}

/** Summary of what a connect migration moved from the placeholder onto the real dealer. */
export interface ConnectMigrationResult {
  placeholder: PlaceholderDealerWithConnection;
  migratedProcesses: number;
  migratedAssignments: number;
  ledgerEntriesMerged: number;
}

/**
 * Atomically connects a placeholder to a real dealer AND migrates everything the agent managed
 * under the placeholder onto that real dealer (so the data lives "on the dealer's name"):
 *  1. re-point the placeholder's `VehicleProcess`, `ProcessAssignment`, `ProcessReference`, and
 *     `DealerReference` rows to the real dealer (process children ride along via `processId`);
 *  2. merge the placeholder's khata into the real dealer's account — move its `LedgerEntry` rows
 *     (tagging `sourceDealerId = placeholderId` for provenance), recompute the real account's
 *     running `balanceAfter`/balance/totals over all entries in `seq` order, and drop the emptied
 *     placeholder account;
 *  3. create/reactivate the CONNECT grant and set `connectedDealerId`.
 *
 * Runs in ONE transaction. Callers enforce the guards (owned placeholder, real subscribed dealer)
 * first. Balances are summed in integer paise to avoid float drift.
 */
export async function connectPlaceholderTx(
  placeholderId: string,
  realDealerId: string,
  agentId: string,
): Promise<ConnectMigrationResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Migrate the dealer-scoped vehicle data.
    const vp = await tx.vehicleProcess.updateMany({
      where: { dealerId: placeholderId },
      data: { dealerId: realDealerId },
    });
    const pa = await tx.processAssignment.updateMany({
      where: { dealerId: placeholderId },
      data: { dealerId: realDealerId },
    });
    await tx.processReference.updateMany({
      where: { dealerId: placeholderId },
      data: { dealerId: realDealerId },
    });
    await tx.dealerReference.updateMany({
      where: { dealerId: placeholderId },
      data: { dealerId: realDealerId },
    });

    // 2. Merge the placeholder's khata (if any) into the real dealer's account.
    let ledgerEntriesMerged = 0;
    const placeholderAccount = await tx.khataAccount.findUnique({
      where: { dealerId_agentId: { dealerId: placeholderId, agentId } },
    });
    if (placeholderAccount) {
      const realAccount = await tx.khataAccount.upsert({
        where: { dealerId_agentId: { dealerId: realDealerId, agentId } },
        create: { dealerId: realDealerId, agentId },
        update: {},
      });
      const moved = await tx.ledgerEntry.updateMany({
        where: { khataAccountId: placeholderAccount.khataAccountId },
        data: {
          dealerId: realDealerId,
          khataAccountId: realAccount.khataAccountId,
          sourceDealerId: placeholderId,
        },
      });
      ledgerEntriesMerged = moved.count;

      // Recompute the merged account's running balances over ALL its entries (chronological seq).
      const all = await tx.ledgerEntry.findMany({
        where: { khataAccountId: realAccount.khataAccountId },
        orderBy: { seq: 'asc' },
      });
      let balanceP = 0;
      let creditP = 0;
      let debitP = 0;
      for (const e of all) {
        const paise = Math.round(e.amount.toNumber() * 100);
        if (e.direction === 'CREDIT') {
          balanceP += paise;
          creditP += paise;
        } else {
          balanceP -= paise;
          debitP += paise;
        }
        await tx.ledgerEntry.update({
          where: { ledgerEntryId: e.ledgerEntryId },
          data: { balanceAfter: balanceP / 100 },
        });
      }
      await tx.khataAccount.update({
        where: { khataAccountId: realAccount.khataAccountId },
        data: { balance: balanceP / 100, totalCredit: creditP / 100, totalDebit: debitP / 100 },
      });
      // The placeholder account now has no entries — remove it.
      await tx.khataAccount.delete({ where: { khataAccountId: placeholderAccount.khataAccountId } });
    }

    // 3. Authorization + connection pointer.
    await tx.dealerAgent.upsert({
      where: { dealerId_agentId: { dealerId: realDealerId, agentId } },
      create: {
        dealerId: realDealerId,
        agentId,
        status: DealerAgentStatus.ACTIVE,
        source: DealerAgentSource.CONNECT,
      },
      update: { status: DealerAgentStatus.ACTIVE, source: DealerAgentSource.CONNECT },
    });
    const placeholder = await tx.dealer.update({
      where: { dealerId: placeholderId },
      data: { connectedDealerId: realDealerId },
      include: { connectedDealer: connectedDealerSelect },
    });

    return {
      placeholder,
      migratedProcesses: vp.count,
      migratedAssignments: pa.count,
      ledgerEntriesMerged,
    };
  });
}
