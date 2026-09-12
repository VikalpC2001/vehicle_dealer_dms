import type { StorageProvider } from './storage-provider';

/**
 * Placeholder for Google Cloud Storage. Not wired in production yet.
 *
 * **Implementation outline:** Instantiate `Storage` from `@google-cloud/storage`,
 * use a dedicated bucket, generate V4 signed URLs for `getUploadUrl`, write via
 * `bucket.file(fileKey).save(buffer)`, and return `https://storage.googleapis.com/...`
 * or a CDN URL from `getPublicUrl`. Preserve the same `fileKey` semantics as local
 * mode so clients do not change.
 */
export class GcsStorageProvider implements StorageProvider {
  /** @inheritdoc */
  getUploadUrl(_fileKey: string, _publicOrigin?: string): string {
    throw new Error('GcsStorageProvider is not implemented');
  }

  /** @inheritdoc */
  saveFile(_buffer: Buffer, _fileKey: string): Promise<void> {
    return Promise.reject(new Error('GcsStorageProvider is not implemented'));
  }

  /** @inheritdoc */
  moveFile(_sourceKey: string, _destKey: string): Promise<void> {
    return Promise.reject(new Error('GcsStorageProvider is not implemented'));
  }

  /** @inheritdoc */
  getPublicUrl(_fileKey: string, _publicOrigin?: string): string {
    throw new Error('GcsStorageProvider is not implemented');
  }

  /** @inheritdoc */
  fileExists(_fileKey: string): Promise<boolean> {
    return Promise.reject(new Error('GcsStorageProvider is not implemented'));
  }
}
