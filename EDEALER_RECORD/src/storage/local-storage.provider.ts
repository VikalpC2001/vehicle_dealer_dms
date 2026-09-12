import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from '../config';
import type { StorageProvider } from './storage-provider';

/**
 * Local filesystem storage under `UPLOAD_DIR`, with HTTP URLs derived from
 * `BASE_URL` and `API_PREFIX`.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadRoot: string;

  /**
   * @param appConfig - Validated application config (BASE_URL, UPLOAD_DIR, API_PREFIX).
   */
  constructor(private readonly appConfig: AppConfig) {
    this.uploadRoot = path.resolve(process.cwd(), appConfig.UPLOAD_DIR);
  }

  /** @inheritdoc */
  getUploadUrl(fileKey: string, publicOrigin?: string): string {
    const base = (publicOrigin ?? this.appConfig.BASE_URL).replace(/\/$/, '');
    const prefix = this.appConfig.API_PREFIX.replace(/\/$/, '');
    return `${base}${prefix}/upload/file/${fileKey}`;
  }

  /** @inheritdoc */
  getPublicUrl(fileKey: string, publicOrigin?: string): string {
    const base = (publicOrigin ?? this.appConfig.BASE_URL).replace(/\/$/, '');
    return `${base}/uploads/${fileKey}`;
  }

  /** @inheritdoc */
  async saveFile(buffer: Buffer, fileKey: string): Promise<void> {
    const safeName = path.basename(fileKey);
    if (safeName !== fileKey || fileKey.includes('..')) {
      throw new Error('Invalid file key');
    }
    const absolute = path.join(this.uploadRoot, safeName);
    const resolvedRoot = path.resolve(this.uploadRoot);
    if (!absolute.startsWith(resolvedRoot + path.sep) && absolute !== resolvedRoot) {
      throw new Error('Invalid file path');
    }
    await fs.mkdir(this.uploadRoot, { recursive: true });
    await fs.writeFile(absolute, buffer, { flag: 'wx' });
  }

  /** @inheritdoc */
  async fileExists(fileKey: string): Promise<boolean> {
    const resolvedRoot = path.resolve(this.uploadRoot);
    const absolute = path.resolve(this.uploadRoot, fileKey);
    if (
      fileKey.includes('..') ||
      (absolute !== resolvedRoot && !absolute.startsWith(resolvedRoot + path.sep))
    ) {
      return false;
    }
    try {
      await fs.access(absolute);
      return true;
    } catch {
      return false;
    }
  }

  /** @inheritdoc */
  async moveFile(sourceKey: string, destKey: string): Promise<void> {
    const resolvedRoot = path.resolve(this.uploadRoot);
    const source = path.resolve(this.uploadRoot, sourceKey);
    const dest = path.resolve(this.uploadRoot, destKey);
    const within = (p: string): boolean =>
      p === resolvedRoot || p.startsWith(resolvedRoot + path.sep);
    if (sourceKey.includes('..') || destKey.includes('..') || !within(source) || !within(dest)) {
      throw new Error('Invalid file path');
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(source, dest);
  }
}
