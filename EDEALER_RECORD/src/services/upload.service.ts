import type { StorageProvider } from '../storage/storage-provider';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import { config } from '../config';
import {
  assertBufferMatchesDeclaredMime,
  assertFilenameMatchesMime,
  assertSafeFileKey,
  assertWithinMaxImageSize,
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
}

/** Default upload service wired to local disk storage. */
export const uploadService = new UploadService(new LocalStorageProvider(config));
