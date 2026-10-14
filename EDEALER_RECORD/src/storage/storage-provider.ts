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

  /**
   * Reads the raw bytes of the object at `key` (which may include a per-process folder segment).
   * Used by server-side export to embed stored images into Excel/PDF. Rejects when the object is
   * missing or the key escapes the storage root; callers that treat a read as best-effort should
   * catch and skip.
   *
   * @param key - Object key to read.
   */
  readFile(key: string): Promise<Buffer>;

  /**
   * Removes the object at the given key. Implementations must treat a missing object as success
   * (idempotent delete) so callers can clean up bytes after a DB row is removed without racing.
   *
   * @param key - Object key to delete.
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Recursively removes the folder (and every object under it) identified by `prefix` — used to
   * clean up a process's whole per-process upload folder after its DB row is permanently deleted.
   * Idempotent: a missing folder is a success (so callers can clean up without racing a purge).
   *
   * @param prefix - Folder prefix (no trailing slash), e.g. `"{registration}_{processId}"`.
   */
  deleteFolder(prefix: string): Promise<void>;

  /**
   * Lists ONLY the top-level upload files in the storage root — bare object keys with no subfolder
   * segment, excluding dotfiles. Used by the orphan-root-upload sweep to find flat-uploaded files that
   * were never moved into a per-process folder. Each entry carries the object's last-modified time so
   * the sweep can apply a retention window.
   *
   * @returns Top-level files as `{ key, lastModified }` (empty when the root does not exist yet).
   */
  listRootFiles(): Promise<Array<{ key: string; lastModified: Date }>>;
}
