import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import * as khataService from '../services/khata.service';
import type { LedgerPersona } from '../services/khata.service';
import { sendSuccess, sendPaginated } from '../utils/api-response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { AppError } from '../utils/app-error';
import type {
  PostEntryBody,
  StatementParams,
  EntryIdParams,
  SettleParams,
  SettleBody,
} from '../validations/khata.validation';

/** Resolves the caller's ledger persona from the access token (agent wins, else dealer). */
function resolveLedgerCaller(req: Request): { persona: LedgerPersona; selfId: string } {
  if (req.user.agentId) return { persona: 'agent', selfId: req.user.agentId };
  if (req.user.dealerId) return { persona: 'dealer', selfId: req.user.dealerId };
  throw new AppError(
    'The khata ledger is only available to dealer or agent accounts',
    StatusCodes.FORBIDDEN,
    4059,
  );
}

/**
 * GET /khata/accounts
 * Lists the caller's khata accounts (dealer → one per agent; agent → one per dealer).
 */
export async function listAccountsHandler(req: Request, res: Response): Promise<void> {
  const { persona, selfId } = resolveLedgerCaller(req);
  const { skip, take } = parsePagination(req.query);
  const { items, total } = await khataService.listAccounts(persona, selfId, skip, take);
  sendPaginated(res, 'Khata accounts retrieved', items, buildPaginationMeta(total, req.query));
}

/**
 * GET /khata/accounts/:counterpartyId/statement
 * Returns the running-balance statement (entries + account summary) for one pair.
 */
export async function getStatementHandler(req: Request, res: Response): Promise<void> {
  const { persona, selfId } = resolveLedgerCaller(req);
  const { counterpartyId } = req.params as unknown as StatementParams;
  const { skip, take } = parsePagination(req.query);
  const { account, entries, total } = await khataService.getStatement(
    persona,
    selfId,
    counterpartyId,
    skip,
    take,
  );
  sendSuccess(res, 'Khata statement retrieved', {
    account,
    entries,
    meta: buildPaginationMeta(total, req.query),
  });
}

/**
 * POST /khata/entries
 * Posts a credit/debit entry to the pair (caller + counterparty).
 */
export async function postEntryHandler(req: Request, res: Response): Promise<void> {
  const { persona, selfId } = resolveLedgerCaller(req);
  const body = req.body as PostEntryBody;
  const result = await khataService.postEntry(persona, selfId, req.user.sub, body);
  sendSuccess(res, 'Ledger entry posted', result, StatusCodes.CREATED);
}

/**
 * POST /khata/entries/:id/reverse
 * Reverses an entry the caller is a party to (posts an opposite counter-entry).
 */
export async function reverseEntryHandler(req: Request, res: Response): Promise<void> {
  const { persona, selfId } = resolveLedgerCaller(req);
  const { id } = req.params as unknown as EntryIdParams;
  const result = await khataService.reverseEntry(persona, selfId, req.user.sub, id);
  sendSuccess(res, 'Ledger entry reversed', result);
}

/**
 * POST /khata/accounts/:counterpartyId/settle
 * Posts a balancing entry to drive the pair's balance toward zero.
 */
export async function settleHandler(req: Request, res: Response): Promise<void> {
  const { persona, selfId } = resolveLedgerCaller(req);
  const { counterpartyId } = req.params as unknown as SettleParams;
  const { amount } = req.body as SettleBody;
  const result = await khataService.settle(persona, selfId, req.user.sub, counterpartyId, amount ?? null);
  sendSuccess(res, 'Khata settled', result);
}
