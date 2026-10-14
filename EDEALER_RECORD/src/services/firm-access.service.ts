import { StatusCodes } from 'http-status-codes';
import {
  findDealerById,
  findDealerAccessById,
  setDealerAccess,
} from '../repositories/dealer.repository';
import {
  findAgentById,
  findAgentAccessById,
  setAgentAccess,
} from '../repositories/agent.repository';
import { AppError } from '../utils/app-error';

/** Message shown to every user of a paused firm (sign-in attempt or live session). */
export const FIRM_ACCESS_PAUSED_MESSAGE =
  'Your account access has been paused. Please contact the super admin.';

/** App error code for a paused firm (HTTP 403). The frontend signs the user out on this code. */
export const FIRM_ACCESS_PAUSED_CODE = 4022;

/**
 * How long a firm's `isActive` flag is served from memory before `authenticate` re-reads it.
 * Bounds how stale another server instance can be; on this instance a toggle is written straight
 * into the cache, so it applies on the very next request.
 */
export const FIRM_ACCESS_CACHE_TTL_MS = 5_000;

/** Result of an access toggle. */
export interface FirmAccessResult {
  id: string;
  isActive: boolean;
}

/** Which table a cached flag belongs to (dealer and agent ids are separate key spaces). */
type FirmKind = 'dealer' | 'agent';

interface CachedFirmAccess {
  isActive: boolean;
  expiresAt: number;
}

/** `kind:id` → last known flag. One small entry per firm with a live session. */
const accessCache = new Map<string, CachedFirmAccess>();

/** `kind:id` → lookup already running, so a burst of parallel requests shares one query. */
const pendingLookups = new Map<string, Promise<boolean>>();

/**
 * `kind:id` → number of toggles written on this instance. A lookup that started before a toggle
 * must not overwrite the toggled value with the row it read earlier.
 */
const accessWriteVersions = new Map<string, number>();

function cacheKey(kind: FirmKind, id: string): string {
  return `${kind}:${id}`;
}

function cacheFirmAccess(key: string, isActive: boolean): void {
  accessCache.set(key, { isActive, expiresAt: Date.now() + FIRM_ACCESS_CACHE_TTL_MS });
}

/** Records a toggle: bumps the write version, detaches any older lookup, caches the new flag. */
function recordFirmAccessWrite(key: string, isActive: boolean): void {
  accessWriteVersions.set(key, (accessWriteVersions.get(key) ?? 0) + 1);
  pendingLookups.delete(key);
  cacheFirmAccess(key, isActive);
}

/** Reads the flag from the database. A missing firm row counts as active (not paused). */
async function loadFirmAccess(kind: FirmKind, id: string): Promise<boolean> {
  const row = kind === 'dealer' ? await findDealerAccessById(id) : await findAgentAccessById(id);
  return row?.isActive ?? true;
}

/** Returns one firm's `isActive` flag: from the cache while fresh, otherwise a live lookup. */
async function isFirmActive(kind: FirmKind, id: string): Promise<boolean> {
  const key = cacheKey(kind, id);
  const cached = accessCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isActive;
  }
  const pending = pendingLookups.get(key);
  if (pending) {
    return pending;
  }
  const versionAtStart = accessWriteVersions.get(key) ?? 0;
  const lookup: Promise<boolean> = loadFirmAccess(kind, id)
    .then((isActive) => {
      if ((accessWriteVersions.get(key) ?? 0) === versionAtStart) {
        cacheFirmAccess(key, isActive);
      }
      return isActive;
    })
    .finally(() => {
      // A toggle may have replaced this entry with a newer lookup — only clear our own.
      if (pendingLookups.get(key) === lookup) {
        pendingLookups.delete(key);
      }
    });
  pendingLookups.set(key, lookup);
  return lookup;
}

/**
 * Builds the "access paused" error (403 / 4022) so the message and code live in one place.
 *
 * @returns A new `AppError` to throw or pass to `next()`.
 */
export function buildFirmAccessPausedError(): AppError {
  return new AppError(FIRM_ACCESS_PAUSED_MESSAGE, StatusCodes.FORBIDDEN, FIRM_ACCESS_PAUSED_CODE);
}

/**
 * Tells whether the linked firm is paused RIGHT NOW (`isActive === false`). Used by `authenticate`
 * on every request, so the answer comes from a short-lived in-process cache
 * ({@link FIRM_ACCESS_CACHE_TTL_MS}) and only falls through to the database when it has expired.
 *
 * A user is linked to at most one firm; if both ids are present, either one being paused counts.
 * A missing firm row counts as NOT paused. No ids → not paused.
 *
 * @param dealerId - Dealer id from the token (`null`/`undefined` when not a dealer user).
 * @param agentId - Agent id from the token (`null`/`undefined` when not an agent user).
 * @returns `true` when access is paused.
 * @throws Whatever the repository lookup throws — callers must treat that as "do not proceed".
 */
export async function isFirmAccessPaused(
  dealerId: string | null | undefined,
  agentId: string | null | undefined,
): Promise<boolean> {
  if (dealerId && !(await isFirmActive('dealer', dealerId))) {
    return true;
  }
  if (agentId && !(await isFirmActive('agent', agentId))) {
    return true;
  }
  return false;
}

/**
 * Ensures the linked firm is not paused (cached live lookup, see {@link isFirmAccessPaused}).
 *
 * @throws AppError 403 (4022) when the dealer or agent firm is paused.
 */
export async function assertFirmAccessActive(
  dealerId: string | null | undefined,
  agentId: string | null | undefined,
): Promise<void> {
  if (await isFirmAccessPaused(dealerId, agentId)) {
    throw buildFirmAccessPausedError();
  }
}

/**
 * Pauses or resumes a dealer's access (super-admin). While paused, the dealer's login users cannot
 * sign in and their live sessions are rejected. The new value is cached immediately so it applies
 * on the very next request. Does not cascade to agents holding a grant on this dealer.
 *
 * @throws AppError 404 (4043) when the dealer does not exist.
 */
export async function setDealerAccessState(
  dealerId: string,
  isActive: boolean,
): Promise<FirmAccessResult> {
  const dealer = await findDealerById(dealerId);
  if (!dealer) {
    throw new AppError('Dealer not found', StatusCodes.NOT_FOUND, 4043);
  }
  const updated = await setDealerAccess(dealerId, isActive);
  recordFirmAccessWrite(cacheKey('dealer', dealer.dealerId), updated.isActive);
  return { id: dealer.dealerId, isActive: updated.isActive };
}

/**
 * Pauses or resumes an agent's access (super-admin). While paused, the agent's login users cannot
 * sign in and their live sessions are rejected. The new value is cached immediately so it applies
 * on the very next request.
 *
 * @throws AppError 404 (4044) when the agent does not exist.
 */
export async function setAgentAccessState(
  agentId: string,
  isActive: boolean,
): Promise<FirmAccessResult> {
  const agent = await findAgentById(agentId);
  if (!agent) {
    throw new AppError('Agent not found', StatusCodes.NOT_FOUND, 4044);
  }
  const updated = await setAgentAccess(agentId, isActive);
  recordFirmAccessWrite(cacheKey('agent', agent.agentId), updated.isActive);
  return { id: agent.agentId, isActive: updated.isActive };
}
