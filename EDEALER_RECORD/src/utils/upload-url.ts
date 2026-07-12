import { config } from '../config';

/**
 * Builds the public read URL for an uploaded file key (local storage layout).
 *
 * @param fileKey - Stored object name (e.g. UUID + extension).
 * @param publicOrigin - Optional origin override (no trailing slash).
 */
export const buildPublicUploadUrl = (fileKey: string, publicOrigin?: string): string => {
  const base = (publicOrigin ?? config.BASE_URL).replace(/\/$/, '');
  return `${base}/uploads/${fileKey}`;
};

/**
 * Resolves a stored image name or link to a browser-ready URL.
 * Returns absolute URLs unchanged; otherwise treats the value as a local upload file key.
 *
 * @param imageNameOrUrl - File key or full URL stored in the database.
 * @param publicOrigin - Optional origin for locally stored files.
 */
export const resolvePhotoUrl = (imageNameOrUrl: string, publicOrigin?: string): string => {
  const trimmed = imageNameOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return buildPublicUploadUrl(trimmed, publicOrigin);
};
