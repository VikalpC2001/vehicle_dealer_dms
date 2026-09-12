import { prisma } from '../config/prisma';
import type {
  Dealer,
  DealerAgent,
  KhataAccount,
  LedgerEntry,
  LedgerDirection,
  Prisma,
  RoleType,
} from '@prisma/client';

/** Account row with the counterparty AGENT summary (dealer-facing list). */
const accountWithAgentSelect = {
  khataAccountId: true,
  dealerId: true,
  agentId: true,
  balance: true,
  totalCredit: true,
  totalDebit: true,
  createdAt: true,
  updatedAt: true,
  agent: { select: { agentId: true, firmName: true, agentName: true, displayName: true } },
} as const;

/** Account row with the counterparty DEALER summary (agent-facing list). */
const accountWithDealerSelect = {
  khataAccountId: true,
  dealerId: true,
  agentId: true,
  balance: true,
  totalCredit: true,
  totalDebit: true,
  createdAt: true,
  updatedAt: true,
  dealer: { select: { dealerId: true, firmName: true, dealerName: true, displayName: true } },
} as const;

export type KhataAccountWithAgent = Pick<
  KhataAccount,
  'khataAccountId' | 'dealerId' | 'agentId' | 'balance' | 'totalCredit' | 'totalDebit' | 'createdAt' | 'updatedAt'
> & { agent: { agentId: string; firmName: string; agentName: string; displayName: string } };

export type KhataAccountWithDealer = Pick<
  KhataAccount,
  'khataAccountId' | 'dealerId' | 'agentId' | 'balance' | 'totalCredit' | 'totalDebit' | 'createdAt' | 'updatedAt'
> & { dealer: { dealerId: string; firmName: string; dealerName: string; displayName: string } };

/** Data for posting a single ledger entry (all scope/grant checks happen in the service first). */
export interface PostEntryData {
  dealerId: string;
  agentId: string;
  direction: LedgerDirection;
  amount: number;
  description?: string | null;
  postedByUserId?: string | null;
  postedByRole: RoleType;
  assignmentId?: string | null;
  sourceDealerId?: string | null;
  /** Effective date shown in the book. Omit to default to now (schema default). */
  entryDate?: Date | null;
}

/** Minimal fields used to resolve a placeholder dealer (to its connected real dealer or its owner). */
export type DealerResolution = Pick<
  Dealer,
  'dealerId' | 'isPlaceholder' | 'connectedDealerId' | 'isSubscribe' | 'ownerAgentId'
>;

/**
 * Returns the live (`ACTIVE`) grant linking a dealer to an agent (any `source`), or `null`.
 * Used to gate every ledger WRITE.
 */
export async function findActiveGrant(
  dealerId: string,
  agentId: string,
): Promise<DealerAgent | null> {
  return prisma.dealerAgent.findFirst({ where: { dealerId, agentId, status: 'ACTIVE' } });
}

/** Fetches the fields needed to resolve a (possibly placeholder) dealer. */
export async function findDealerForResolution(dealerId: string): Promise<DealerResolution | null> {
  return prisma.dealer.findUnique({
    where: { dealerId },
    select: {
      dealerId: true,
      isPlaceholder: true,
      connectedDealerId: true,
      isSubscribe: true,
      ownerAgentId: true,
    },
  });
}

/** Lists a dealer's khata accounts (one per agent), with the agent summary + total. */
export async function listAccountsForDealer(
  dealerId: string,
  skip: number,
  take: number,
): Promise<{ items: KhataAccountWithAgent[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.khataAccount.findMany({
      where: { dealerId },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      select: accountWithAgentSelect,
    }),
    prisma.khataAccount.count({ where: { dealerId } }),
  ]);
  return { items, total };
}

/** Lists an agent's khata accounts (one per dealer), with the dealer summary + total. */
export async function listAccountsForAgent(
  agentId: string,
  skip: number,
  take: number,
): Promise<{ items: KhataAccountWithDealer[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.khataAccount.findMany({
      where: { agentId },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      select: accountWithDealerSelect,
    }),
    prisma.khataAccount.count({ where: { agentId } }),
  ]);
  return { items, total };
}

/** Fetches the single account for a (dealer, agent) pair, or `null`. */
export async function findAccount(
  dealerId: string,
  agentId: string,
): Promise<KhataAccount | null> {
  return prisma.khataAccount.findUnique({ where: { dealerId_agentId: { dealerId, agentId } } });
}

/** Lists ledger entries for a pair (newest first by `seq`), with total. Both ids are pinned. */
export async function getStatement(
  dealerId: string,
  agentId: string,
  skip: number,
  take: number,
): Promise<{ items: LedgerEntry[]; total: number }> {
  const where = { dealerId, agentId };
  const [items, total] = await Promise.all([
    prisma.ledgerEntry.findMany({ where, orderBy: { seq: 'desc' }, skip, take }),
    prisma.ledgerEntry.count({ where }),
  ]);
  return { items, total };
}

/** Finds a single ledger entry by id (raw row), or `null`. */
export async function findEntryById(ledgerEntryId: string): Promise<LedgerEntry | null> {
  return prisma.ledgerEntry.findUnique({ where: { ledgerEntryId } });
}

/**
 * Posts one entry on a caller-supplied transaction client, so it can compose into a larger
 * transaction (e.g. an assignment-create that also records an agent cost). Concurrency-safe: the
 * balance is changed by an ATOMIC row-locked `update({ increment })`, and the returned balance is
 * snapshotted as `balanceAfter`. The account is lazily created on first post. `entryDate` (when
 * given) sets the book-facing date; otherwise the schema default (now) applies.
 */
export async function postEntryOnTx(
  tx: Prisma.TransactionClient,
  data: PostEntryData,
): Promise<{ account: KhataAccount; entry: LedgerEntry }> {
  const delta = data.direction === 'CREDIT' ? data.amount : -data.amount;
  await tx.khataAccount.upsert({
    where: { dealerId_agentId: { dealerId: data.dealerId, agentId: data.agentId } },
    create: { dealerId: data.dealerId, agentId: data.agentId },
    update: {},
  });
  const account = await tx.khataAccount.update({
    where: { dealerId_agentId: { dealerId: data.dealerId, agentId: data.agentId } },
    data: {
      balance: { increment: delta },
      totalCredit: { increment: data.direction === 'CREDIT' ? data.amount : 0 },
      totalDebit: { increment: data.direction === 'DEBIT' ? data.amount : 0 },
    },
  });
  const entry = await tx.ledgerEntry.create({
    data: {
      khataAccountId: account.khataAccountId,
      dealerId: data.dealerId,
      agentId: data.agentId,
      direction: data.direction,
      amount: data.amount,
      balanceAfter: account.balance,
      description: data.description ?? null,
      ...(data.entryDate ? { entryDate: data.entryDate } : {}),
      postedByUserId: data.postedByUserId ?? null,
      postedByRole: data.postedByRole,
      assignmentId: data.assignmentId ?? null,
      sourceDealerId: data.sourceDealerId ?? null,
    },
  });
  return { account, entry };
}

/**
 * Posts one entry inside its own transaction (the standalone ledger-write path). Delegates to
 * {@link postEntryOnTx}.
 */
export async function postEntry(
  data: PostEntryData,
): Promise<{ account: KhataAccount; entry: LedgerEntry }> {
  return prisma.$transaction((tx) => postEntryOnTx(tx, data));
}

/**
 * Reverses an entry on a caller-supplied transaction client (composes into a larger transaction).
 * Posts an opposite-direction REVERSAL entry, stamps the original `isReversed = true`, and adjusts
 * the balance. Re-checks the guards inside the transaction. Throws plain errors with a `code` the
 * service maps to AppError.
 */
export async function reverseEntryOnTx(
  tx: Prisma.TransactionClient,
  originalId: string,
  postedByUserId: string | null,
  postedByRole: RoleType,
): Promise<{ account: KhataAccount; reversal: LedgerEntry }> {
  const orig = await tx.ledgerEntry.findUnique({ where: { ledgerEntryId: originalId } });
  if (!orig) throw Object.assign(new Error('Entry not found'), { code: 4040 });
  if (orig.reversesEntryId) throw Object.assign(new Error('Cannot reverse a reversal'), { code: 4056 });
  if (orig.isReversed) throw Object.assign(new Error('Entry already reversed'), { code: 4055 });

  const oppDirection: LedgerDirection = orig.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
  const amountNum = orig.amount.toNumber();
  const delta = oppDirection === 'CREDIT' ? amountNum : -amountNum;

  const account = await tx.khataAccount.update({
    where: { khataAccountId: orig.khataAccountId },
    data: {
      balance: { increment: delta },
      totalCredit: { increment: oppDirection === 'CREDIT' ? amountNum : 0 },
      totalDebit: { increment: oppDirection === 'DEBIT' ? amountNum : 0 },
    },
  });
  const reversal = await tx.ledgerEntry.create({
    data: {
      khataAccountId: orig.khataAccountId,
      dealerId: orig.dealerId,
      agentId: orig.agentId,
      direction: oppDirection,
      amount: orig.amount,
      balanceAfter: account.balance,
      description: `Reversal of entry ${orig.ledgerEntryId}`,
      postedByUserId,
      postedByRole,
      reversesEntryId: orig.ledgerEntryId,
    },
  });
  await tx.ledgerEntry.update({
    where: { ledgerEntryId: orig.ledgerEntryId },
    data: { isReversed: true },
  });
  return { account, reversal };
}

/**
 * Reverses an entry inside its own transaction (the standalone reverse path). Delegates to
 * {@link reverseEntryOnTx}.
 */
export async function reverseEntry(
  originalId: string,
  postedByUserId: string | null,
  postedByRole: RoleType,
): Promise<{ account: KhataAccount; reversal: LedgerEntry }> {
  return prisma.$transaction((tx) => reverseEntryOnTx(tx, originalId, postedByUserId, postedByRole));
}

/**
 * Finds the single live "agent cost" entry a dealer posted for an assignment: a `CREDIT` linked to
 * the assignment that is neither reversed nor itself a reversal. Returns null when there is none.
 * The `OnTx` variant composes into a larger transaction (assignment create / cost edit).
 */
export async function findActiveAssignmentCostEntryOnTx(
  tx: Prisma.TransactionClient,
  assignmentId: string,
): Promise<LedgerEntry | null> {
  return tx.ledgerEntry.findFirst({
    where: {
      assignmentId,
      direction: 'CREDIT',
      isReversed: false,
      reversesEntryId: null,
    },
    orderBy: { seq: 'desc' },
  });
}

export async function findActiveAssignmentCostEntry(
  assignmentId: string,
): Promise<LedgerEntry | null> {
  return findActiveAssignmentCostEntryOnTx(prisma, assignmentId);
}

/**
 * Batch variant of {@link findActiveAssignmentCostEntry} for list enrichment: the live cost entry
 * per assignment id. Returns a map keyed by `assignmentId`.
 */
export async function listActiveCostEntriesForAssignments(
  assignmentIds: string[],
): Promise<Map<string, LedgerEntry>> {
  if (assignmentIds.length === 0) return new Map();
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      assignmentId: { in: assignmentIds },
      direction: 'CREDIT',
      isReversed: false,
      reversesEntryId: null,
    },
    orderBy: { seq: 'desc' },
  });
  const map = new Map<string, LedgerEntry>();
  for (const row of rows) {
    if (row.assignmentId && !map.has(row.assignmentId)) map.set(row.assignmentId, row);
  }
  return map;
}

/**
 * In-place metadata update for a ledger entry that does NOT touch the amount (safe for the
 * running `balanceAfter` snapshots): the book-facing `entryDate` and/or `description`. Used when a
 * dealer edits only the date/note of an assignment cost. Runs on the caller's transaction.
 */
export async function updateEntryMetaOnTx(
  tx: Prisma.TransactionClient,
  ledgerEntryId: string,
  meta: { entryDate?: Date; description?: string | null },
): Promise<LedgerEntry> {
  return tx.ledgerEntry.update({
    where: { ledgerEntryId },
    data: {
      ...(meta.entryDate ? { entryDate: meta.entryDate } : {}),
      ...(meta.description !== undefined ? { description: meta.description } : {}),
    },
  });
}

/**
 * Settle logic on a caller-supplied transaction client, so it can compose into a larger
 * transaction (e.g. the agent-switch flow) instead of opening its own. Posts a balancing entry
 * sized from the CURRENT balance (read inside the passed tx). Optional `requestedAmount` caps a
 * partial settlement; `note` overrides the entry description. Throws `{ code: 4058 }` when the
 * balance is already zero.
 */
export async function settleAccountOnTx(
  tx: Prisma.TransactionClient,
  params: {
    dealerId: string;
    agentId: string;
    requestedAmount: number | null;
    postedByUserId: string | null;
    postedByRole: RoleType;
    note?: string;
  },
): Promise<{ account: KhataAccount; entry: LedgerEntry }> {
  const { dealerId, agentId, requestedAmount, postedByUserId, postedByRole, note } = params;
  const existing = await tx.khataAccount.findUnique({
    where: { dealerId_agentId: { dealerId, agentId } },
  });
  if (!existing) throw Object.assign(new Error('No khata account to settle'), { code: 4040 });
  const balNum = existing.balance.toNumber();
  if (balNum === 0) throw Object.assign(new Error('Account is already settled'), { code: 4058 });

  const magnitude = Math.abs(balNum);
  const settleAmount = requestedAmount != null ? Math.min(requestedAmount, magnitude) : magnitude;
  // Reduce the balance toward zero: a positive balance (dealer owes agent) needs a DEBIT.
  const direction: LedgerDirection = balNum > 0 ? 'DEBIT' : 'CREDIT';
  const delta = direction === 'CREDIT' ? settleAmount : -settleAmount;

  const account = await tx.khataAccount.update({
    where: { khataAccountId: existing.khataAccountId },
    data: {
      balance: { increment: delta },
      totalCredit: { increment: direction === 'CREDIT' ? settleAmount : 0 },
      totalDebit: { increment: direction === 'DEBIT' ? settleAmount : 0 },
    },
  });
  const entry = await tx.ledgerEntry.create({
    data: {
      khataAccountId: existing.khataAccountId,
      dealerId,
      agentId,
      direction,
      amount: settleAmount,
      balanceAfter: account.balance,
      description: note ?? 'Settlement',
      postedByUserId,
      postedByRole,
    },
  });
  return { account, entry };
}

/**
 * Settles an account by posting a balancing entry sized from the CURRENT balance, read inside the
 * locked transaction so concurrent posts cannot desync the settle amount. Optional `requestedAmount`
 * caps a partial settlement; optional `note` overrides the entry description. Throws `{ code: 4058 }`
 * when the balance is already zero.
 */
export async function settleAccount(
  dealerId: string,
  agentId: string,
  requestedAmount: number | null,
  postedByUserId: string | null,
  postedByRole: RoleType,
  note?: string,
): Promise<{ account: KhataAccount; entry: LedgerEntry }> {
  return prisma.$transaction((tx) =>
    settleAccountOnTx(tx, {
      dealerId,
      agentId,
      requestedAmount,
      postedByUserId,
      postedByRole,
      note,
    }),
  );
}
