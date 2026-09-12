import type { StorageProvider } from '../storage/storage-provider';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import { config } from '../config';
import {
  assertBufferMatchesDeclaredMime,
  assertFilenameMatchesMime,
  assertSafeFileKey,
  assertWithinMaxImageSize,
  buildProcessScopedKey,
  generateFileName,
  normalizeContentType,
  validateMimeType,
  type AllowedImageMimeType,
} from '../utils/file.utils';
import { AppError } from '../utils/app-error';
import { StatusCodes } from 'http-status-codes';

/**
 * Coordinates presigned-style URL generation and persisting uploaded bytes.
 *
 * **Migrating to GCS:** Replace `LocalStorageProvider` with `GcsStorageProvider`
 * (or inject via DI). Keep `generateUploadUrl` / `saveFile` signatures and the
 * JSON fields `uploadUrl`, `fileKey`, `publicUrl` unchanged; only `getUploadUrl`
 * becomes a Google-signed PUT URL.
 */
export class UploadService {
  /**
   * @param storage - Backing object store (local disk or cloud).
   */
  constructor(private readonly storage: StorageProvider) {}

  /**
   * Reserves a new object key and returns URLs for direct PUT and public read.
   *
   * @param fileName - Original filename (extension must match `contentType`).
   * @param contentType - Declared MIME type for the upcoming upload.
   * @param publicOrigin - Optional `protocol://host:port`; omitted uses config `BASE_URL` in storage.
   */
  generateUploadUrl(
    fileName: string,
    contentType: string,
    publicOrigin?: string,
  ): { uploadUrl: string; fileKey: string; publicUrl: string } {
    validateMimeType(contentType);
    const mime = normalizeContentType(contentType) as AllowedImageMimeType;
    assertFilenameMatchesMime(fileName, mime);
    const fileKey = generateFileName(mime);
    return {
      uploadUrl: this.storage.getUploadUrl(fileKey, publicOrigin),
      fileKey,
      publicUrl: this.storage.getPublicUrl(fileKey, publicOrigin),
    };
  }

  /**
   * Writes the uploaded body to storage if validation passes.
   *
   * @param buffer - Raw request body.
   * @param fileKey - Key previously issued by `generateUploadUrl`.
   * @param contentType - `Content-Type` of the PUT request (must match allowed image types).
   * @param publicOrigin - Optional origin for `publicUrl` (match generate); omitted uses `BASE_URL`.
   */
  async saveFile(
    buffer: Buffer,
    fileKey: string,
    contentType: string | undefined,
    publicOrigin?: string,
  ): Promise<{ publicUrl: string }> {
    validateMimeType(contentType);
    const mime = normalizeContentType(contentType) as AllowedImageMimeType;
    assertSafeFileKey(fileKey);
    assertWithinMaxImageSize(buffer);
    assertBufferMatchesDeclaredMime(buffer, mime);
    try {
      await this.storage.saveFile(buffer, fileKey);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'EEXIST'
      ) {
        throw new AppError('Upload target already exists', StatusCodes.CONFLICT, 4091);
      }
      throw err;
    }
    return { publicUrl: this.storage.getPublicUrl(fileKey, publicOrigin) };
  }

  /**
   * Best-effort move that never throws — returns `true` when the object was relocated. Used both to
   * place a file in its per-process folder and to roll that move back if the surrounding DB write
   * fails (so a retry finds the file where it started).
   *
   * @param sourceKey - Existing object key.
   * @param destKey - Target object key.
   */
  async tryMove(sourceKey: string, destKey: string): Promise<boolean> {
    if (sourceKey === destKey) {
      return false;
    }
    try {
      await this.storage.moveFile(sourceKey, destKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Moves a flat-uploaded file into its per-process folder `"{registration}_{processId}/"` and
   * returns the new (folder-scoped) key to store on the photo record. Idempotent: a key that already
   * contains a folder is returned unchanged without a move. On any move failure (e.g. the source is
   * missing) the original flat key is returned so the reference stays valid. If the caller's DB write
   * then fails it must roll the move back with {@link tryMove}(newKey, originalKey).
   *
   * Two photos on one process may reference the SAME uploaded file (one image tagged under two
   * categories). The destination key is deterministic, so the first reference moves the bytes and the
   * rest find the source already gone — for those, the folder key is still correct as long as the
   * destination now holds the bytes, so we resolve to it instead of falling back to the stale flat key.
   *
   * @param fileKey - The flat upload key currently stored (e.g. `"<uuid>.jpg"`).
   * @param registrationNumber - The process's vehicle registration number.
   * @param processId - The vehicle process UUID.
   */
  async relocateToProcessFolder(
    fileKey: string,
    registrationNumber: string | null | undefined,
    processId: string,
  ): Promise<string> {
    const destKey = buildProcessScopedKey(registrationNumber, processId, fileKey);
    if (destKey === fileKey) {
      return fileKey;
    }
    if (await this.tryMove(fileKey, destKey)) {
      return destKey;
    }
    // Move failed (commonly: a sibling reference already moved the shared source). If the bytes are
    // now at the destination, the folder key is authoritative; otherwise keep the original key.
    const destHasBytes = await this.storage.fileExists(destKey).catch(() => false);
    return destHasBytes ? destKey : fileKey;
  }
}

/** Default upload service wired to local disk storage. */
export const uploadService = new UploadService(new LocalStorageProvider(config));
