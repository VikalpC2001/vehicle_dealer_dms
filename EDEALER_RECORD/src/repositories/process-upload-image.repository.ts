import { prisma } from '../config/prisma';

/**
 * Returns EVERY `{ imageName, imageLink }` pair from the legacy `ProcessUploadImage` model, across all
 * processes and regardless of `deletedAt`. This model is read-only for the current app (no writes) but
 * still owns upload bytes: `imageName` is a (possibly flat) object key and `imageLink` is either a full
 * public URL or a bare key. Both feed the orphan-root-upload sweep's referenced-key set (raw value +
 * basename) so a legacy-referenced flat upload is never deleted.
 */
export async function findAllUploadImageKeys(): Promise<
  Array<{ imageName: string | null; imageLink: string | null }>
> {
  return prisma.processUploadImage.findMany({
    select: { imageName: true, imageLink: true },
  });
}
