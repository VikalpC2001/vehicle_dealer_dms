import { prisma } from '../config/prisma';

/**
 * Runs a trivial query, proving the database accepts connections and answers. Rejects otherwise.
 */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
