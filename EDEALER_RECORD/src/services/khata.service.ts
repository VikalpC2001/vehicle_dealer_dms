import { StatusCodes } from 'http-status-codes';
import type { KhataAccount, LedgerEntry, RoleType } from '@prisma/client';
import * as khataRepository from '../repositories/khata.repository';
import { AppError } from '../utils/app-error';

/** Which side of the book the caller is. */
export type LedgerPersona = 'dealer' | 'agent';

/** A resolved (real-dealer, agent) pair plus the original source dealer id (placeholder provenance). */
interface ResolvedPair {
  dealerId: string;
  agentId: string;
  sourceDealerId: string | null;
  /** True when the write is authorized by placeholder ownership (no DealerAgent grant needed). */
  authorizedByOwnership: boolean;
}

const roleFor = (persona: LedgerPersona): RoleType => (persona === 'agent' ? 'AGENT' : 'DEALER');

/** Maps a repository-thrown `{ code }` error to an AppError; rethrows anything else. */
function mapRepoError(err: unknown): never {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'number') {
    const code = (err as { code: number }).code;
    const message = (err as { message?: string }).message ?? 'Ledger operation failed';
    const statusByCode: Record<number, number> = {
      4040: StatusCodes.NOT_FOUND,
      4054: StatusCodes.FORBIDDEN,
      4055: StatusCodes.CONFLICT,
      4056: StatusCodes.UNPROCESSABLE_ENTITY,
      4057: StatusCodes.UNPROCESSABLE_ENTITY,
      4058: StatusCodes.UNPROCESSABLE_ENTITY,
    };
    throw new AppError(message, statusByCode[code] ?? StatusCodes.BAD_REQUEST, code);
  }
  throw err;
}

/** DTO: a Decimal/BigInt-free account with the counterparty summary attached as `counterparty`. */
function toAccountDto(
  row: khataRepository.KhataAccountWithAgent | khataRepository.KhataAccountWithDealer,
): Record<string, unknown> {
  const counterparty = 'agent' in row ? row.agent : row.dealer;
  return {
    khataAccountId: row.khataAccountId,
    dealerId: row.dealerId,
    agentId: row.agentId,
    balance: row.balance.toNumber(),
    totalCredit: row.totalCredit.toNumber(),
    totalDebit: row.totalDebit.toNumber(),
    counterparty,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** DTO for the account summary returned alongside a statement (no counterparty join). */
function toAccountSummaryDto(acc: KhataAccount): Record<string, unknown> {
  return {
    khataAccountId: acc.khataAccountId,
    dealerId: acc.dealerId,
    agentId: acc.agentId,
    balance: acc.balance.toNumber(),
    totalCredit: acc.totalCredit.toNumber(),
    totalDebit: acc.totalDebit.toNumber(),
    updatedAt: acc.updatedAt,
  };
}

/** DTO: a Decimal/BigInt-free ledger entry (amounts as numbers, `seq` as number). */
function toEntryDto(e: LedgerEntry): Record<string, unknown> {
  return {
    ledgerEntryId: e.ledgerEntryId,
    dealerId: e.dealerId,
    agentId: e.agentId,
    direction: e.direction,
    amount: e.amount.toNumber(),
    balanceAfter: e.balanceAfter.toNumber(),
    description: e.description,
    entryDate: e.entryDate,
    seq: Number(e.seq),
    postedByRole: e.postedByRole,
    postedByUserId: e.postedByUserId,
    assignmentId: e.assignmentId,
    sourceDealerId: e.sourceDealerId,
    reversesEntryId: e.reversesEntryId,
    isReversed: e.isReversed,
    createdAt: e.createdAt,
  };
}

/**
 * Resolves the (real-dealer, agent) pair for a WRITE from the caller persona + counterparty id.
 * For an agent posting against a placeholder dealer:
 * - **connected** placeholder → route to the connected real dealer (grant-authorized), recording
 *   the placeholder id as provenance;
 * - **unconnected placeholder the agent owns** → book to the placeholder's OWN account (an
 *   independent ledger), authorized by ownership (no grant needed);
 * - unconnected placeholder the agent does not own → 4057 (connect first).
 */
async function resolveWritePair(
  persona: LedgerPersona,
  selfId: string,
  counterpartyId: string,
): Promise<ResolvedPair> {
  if (persona === 'dealer') {
    // The caller's own dealer is a real dealer; the counterparty is the agent.
    return { dealerId: selfId, agentId: counterpartyId, sourceDealerId: null, authorizedByOwnership: false };
  }
  // Agent caller: counterparty is a dealer that may be a placeholder.
  const dealer = await khataRepository.findDealerForResolution(counterpartyId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4040);
  }
  if (dealer.isPlaceholder) {
    if (dealer.connectedDealerId) {
      return {
        dealerId: dealer.connectedDealerId,
        agentId: selfId,
        sourceDealerId: dealer.dealerId,
        authorizedByOwnership: false,
      };
    }
    if (dealer.ownerAgentId === selfId) {
      // Independent placeholder ledger — booked to the placeholder itself, owner-authorized.
      return { dealerId: dealer.dealerId, agentId: selfId, sourceDealerId: null, authorizedByOwnership: true };
    }
    throw new AppError(
      'Connect this placeholder to a real dealer before posting to the khata',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4057,
    );
  }
  return { dealerId: counterpartyId, agentId: selfId, sourceDealerId: null, authorizedByOwnership: false };
}

/** True when `dealerId` is a placeholder the agent owns (independent-ledger authorization). */
async function isAgentOwnedPlaceholder(dealerId: string, agentId: string): Promise<boolean> {
  const dealer = await khataRepository.findDealerForResolution(dealerId);
  return !!(dealer?.isPlaceholder && dealer.ownerAgentId === agentId);
}

/** Asserts a live (ACTIVE) dealer↔agent grant exists; ledger WRITES require it (4054). */
async function assertActivePairGrant(dealerId: string, agentId: string): Promise<void> {
  const grant = await khataRepository.findActiveGrant(dealerId, agentId);
  if (!grant) {
    throw new AppError(
      'No active dealer–agent relationship for this khata; posting is not allowed',
      StatusCodes.FORBIDDEN,
      4054,
    );
  }
}

/** Lists the caller's khata accounts (dealer → per agent; agent → per dealer). */
export async function listAccounts(
  persona: LedgerPersona,
  selfId: string,
  skip: number,
  take: number,
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const { items, total } =
    persona === 'dealer'
      ? await khataRepository.listAccountsForDealer(selfId, skip, take)
      : await khataRepository.listAccountsForAgent(selfId, skip, take);
  return { items: items.map(toAccountDto), total };
}

/**
 * Returns the statement (entries newest-first + account summary) for a pair. Reads do NOT require an
 * active grant (parties can always see what's owed); both ids are pinned to the caller.
 */
export async function getStatement(
  persona: LedgerPersona,
  selfId: string,
  counterpartyId: string,
  skip: number,
  take: number,
): Promise<{ account: Record<string, unknown> | null; entries: Record<string, unknown>[]; total: number }> {
  const dealerId = persona === 'dealer' ? selfId : counterpartyId;
  const agentId = persona === 'agent' ? selfId : counterpartyId;
  const [account, statement] = await Promise.all([
    khataRepository.findAccount(dealerId, agentId),
    khataRepository.getStatement(dealerId, agentId, skip, take),
  ]);
  return {
    account: account ? toAccountSummaryDto(account) : null,
    entries: statement.items.map(toEntryDto),
    total: statement.total,
  };
}

/** Posts a credit/debit entry. Resolves the pair, asserts the grant, then writes atomically. */
export async function postEntry(
  persona: LedgerPersona,
  selfId: string,
  postedByUserId: string,
  body: { counterpartyId: string; direction: 'CREDIT' | 'DEBIT'; amount: number; description?: string; assignmentId?: string },
): Promise<{ account: Record<string, unknown>; entry: Record<string, unknown> }> {
  const pair = await resolveWritePair(persona, selfId, body.counterpartyId);
  if (!pair.authorizedByOwnership) {
    await assertActivePairGrant(pair.dealerId, pair.agentId);
  }
  const { account, entry } = await khataRepository
    .postEntry({
      dealerId: pair.dealerId,
      agentId: pair.agentId,
      direction: body.direction,
      amount: body.amount,
      description: body.description ?? null,
      postedByUserId,
      postedByRole: roleFor(persona),
      assignmentId: body.assignmentId ?? null,
      sourceDealerId: pair.sourceDealerId,
    })
    .catch(mapRepoError);
  return { account: toAccountSummaryDto(account), entry: toEntryDto(entry) };
}

/** Reverses an entry the caller is a party to (either side may reverse the shared book). */
export async function reverseEntry(
  persona: LedgerPersona,
  selfId: string,
  postedByUserId: string,
  entryId: string,
): Promise<{ account: Record<string, unknown>; entry: Record<string, unknown> }> {
  const original = await khataRepository.findEntryById(entryId);
  if (!original) {
    throw new AppError('Entry not found', StatusCodes.NOT_FOUND, 4040);
  }
  // Caller must be a party to this entry's pair.
  const callerOwns = persona === 'dealer' ? original.dealerId === selfId : original.agentId === selfId;
  if (!callerOwns) {
    throw new AppError('You do not have access to this entry', StatusCodes.FORBIDDEN, 4037);
  }
  if (original.reversesEntryId) {
    throw new AppError('Cannot reverse a reversal', StatusCodes.UNPROCESSABLE_ENTITY, 4056);
  }
  if (original.isReversed) {
    throw new AppError('Entry already reversed', StatusCodes.CONFLICT, 4055);
  }
  // An entry on a placeholder the agent owns is authorized by ownership (no grant to require).
  const ownerAuthorized =
    persona === 'agent' && (await isAgentOwnedPlaceholder(original.dealerId, selfId));
  if (!ownerAuthorized) {
    await assertActivePairGrant(original.dealerId, original.agentId);
  }
  const { account, reversal } = await khataRepository
    .reverseEntry(entryId, postedByUserId, roleFor(persona))
    .catch(mapRepoError);
  return { account: toAccountSummaryDto(account), entry: toEntryDto(reversal) };
}

/** Settles a pair by posting a balancing entry (sized inside the locked transaction). */
export async function settle(
  persona: LedgerPersona,
  selfId: string,
  postedByUserId: string,
  counterpartyId: string,
  requestedAmount: number | null,
): Promise<{ account: Record<string, unknown>; entry: Record<string, unknown> }> {
  const pair = await resolveWritePair(persona, selfId, counterpartyId);
  if (!pair.authorizedByOwnership) {
    await assertActivePairGrant(pair.dealerId, pair.agentId);
  }
  const { account, entry } = await khataRepository
    .settleAccount(pair.dealerId, pair.agentId, requestedAmount, postedByUserId, roleFor(persona))
    .catch(mapRepoError);
  return { account: toAccountSummaryDto(account), entry: toEntryDto(entry) };
}
