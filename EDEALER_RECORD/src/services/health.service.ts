import { StatusCodes } from 'http-status-codes';
import * as healthRepository from '../repositories/health.repository';
import { AppError } from '../utils/app-error';
import { logUnknownError } from '../utils/logger';

/** How long the database may take to answer the readiness ping. */
const READINESS_TIMEOUT_MS = 2000;

/** Readiness result: the API and its database can serve requests. */
export interface ReadinessResult {
  status: 'ok';
  database: 'ok';
  timestamp: string;
}

/**
 * Checks the API can serve requests: the database answers a trivial query within
 * {@link READINESS_TIMEOUT_MS}. Used by deploy health checks and monitors (liveness stays on
 * `GET /health`, which never touches the database).
 *
 * @throws AppError 503/5030 when the database does not answer in time or the query fails.
 */
export async function checkReadiness(): Promise<ReadinessResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Database ping timed out')), READINESS_TIMEOUT_MS);
  });
  try {
    await Promise.race([healthRepository.pingDatabase(), timeout]);
  } catch (err) {
    logUnknownError('Readiness check failed', err);
    throw new AppError('Database unavailable', StatusCodes.SERVICE_UNAVAILABLE, 5030);
  } finally {
    clearTimeout(timer);
  }
  return { status: 'ok', database: 'ok', timestamp: new Date().toISOString() };
}
