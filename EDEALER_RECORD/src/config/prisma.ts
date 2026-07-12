import { PrismaClient } from '@prisma/client';
import { config } from './index';

const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Returns the process-wide Prisma client. Whenever this module is re-evaluated (e.g. `tsx`
 * watch), the previous client is disconnected and a new one is created so `prisma generate`
 * output is picked up without a full process restart.
 *
 * Note: caching the client forever in production caused stale clients (missing new models
 * like `processTask`) when `NODE_ENV=production` was used with a file watcher or the process
 * was not restarted after `prisma generate`.
 */
const resolvePrismaClient = (): PrismaClient => {
  const previous = globalThis.__prisma;
  const client = createPrismaClient();
  globalThis.__prisma = client;
  if (previous) {
    void previous.$disconnect().catch(() => undefined);
  }
  return client;
};

/** Shared Prisma client for the process (refreshed when this module reloads). */
export const prisma: PrismaClient = resolvePrismaClient();
