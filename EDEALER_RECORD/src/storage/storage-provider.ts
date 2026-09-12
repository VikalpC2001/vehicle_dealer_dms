/**
 * Abstraction for object storage (local disk today, GCS/S3 later).
 *
 * **Migrating to Google Cloud Storage:** Swap `LocalStorageProvider` for
 * `GcsStorageProvider` in the upload service wiring. Use
 * `@google-cloud/storage` `file.getSignedUrl({ action: 'write', ... })` for
 * `getUploadUrl`, `file.save()` with a stream/buffer for `saveFile`, and
 * public bucket URL or signed read URL for `getPublicUrl`. Keep the same HTTP
 * API response shape (`uploadUrl`, `fileKey`, `publicUrl`) so the frontend
 * stays unchanged.
 */
export interface StorageProvider {
  /**
   * Returns the absolute URL the client should PUT the raw bytes to (local:
   * same app; cloud: pre-signed URL).
   *
   * @param publicOrigin - Optional origin (`https://host:port`); when omitted, use config `BASE_URL`.
   */
  getUploadUrl(fileKey: string, publicOrigin?: string): string;

  /**
   * Persists the object under the given key.
   */
  saveFile(buffer: Buffer, fileKey: string): Promise<void>;

  /**
   * Relocates an existing object from `sourceKey` to `destKey` (used to move a flat-uploaded file
   * into its per-process folder once the process id is known). Destination directories are created
   * as needed. Both keys are server-computed; implementations must still guard against path escape.
   *
   * @param sourceKey - Existing object key (the flat upload key).
   * @param destKey - New object key (may include a folder segment).
   */
  moveFile(sourceKey: string, destKey: string): Promise<void>;

  /**
   * Returns the canonical public URL for reading the object after upload.
   *
   * @param publicOrigin - Optional origin; when omitted, use config `BASE_URL`.
   */
  getPublicUrl(fileKey: string, publicOrigin?: string): string;

  /**
   * Reports whether an object exists at the given key. Used to resolve a relocation when the source
   * has already been moved by a sibling reference sharing the same upload.
   *
   * @param fileKey - Object key to probe.
   */
  fileExists(fileKey: string): Promise<boolean>;
}
