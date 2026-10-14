import { randomUUID } from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import { AppError } from './app-error';

/** MIME types permitted for direct document uploads — photos plus PDF documents. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

/** Union of allowed upload MIME type literals. */
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const MIME_TO_CANONICAL_EXT: Record<AllowedImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

/**
 * Maximum upload size for raw PUT bodies (5 MiB).
 */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Normalizes a Content-Type header value (strips parameters such as `; charset=binary`).
 *
 * @param headerValue - Raw `Content-Type` header.
 * @returns The MIME type portion or `undefined` if missing.
 */
export const normalizeContentType = (headerValue: string | undefined): string | undefined => {
  if (!headerValue) {
    return undefined;
  }
  return headerValue.split(';')[0]?.trim().toLowerCase();
};

/**
 * Returns true if the given MIME type is allowed for uploads.
 *
 * @param mime - Normalized MIME string.
 */
export const isAllowedImageMimeType = (mime: string | undefined): mime is AllowedImageMimeType => {
  return mime !== undefined && ALLOWED_MIME_SET.has(mime);
};

/**
 * Ensures the MIME type is one of the supported image types.
 *
 * @param contentType - Normalized or raw Content-Type value.
 * @throws AppError when the type is missing or not allowed.
 */
export const validateMimeType = (contentType: string | undefined): void => {
  const mime = normalizeContentType(contentType);
  if (!isAllowedImageMimeType(mime)) {
    throw new AppError(
      'Unsupported or missing Content-Type; allowed: image/png, image/jpeg, image/webp, application/pdf',
      StatusCodes.UNSUPPORTED_MEDIA_TYPE,
      4150,
    );
  }
};

/**
 * Extracts the file extension from a filename (without the leading dot), lowercased.
 *
 * @param fileName - Original client file name.
 * @returns Extension or empty string if none.
 */
export const extractExtension = (fileName: string): string => {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) {
    return '';
  }
  return base.slice(dot + 1).toLowerCase();
};

/**
 * Verifies that the filename extension is consistent with the declared MIME type
 * (reduces confusing client mistakes).
 *
 * @param fileName - Original file name from the generate-url request.
 * @param contentType - Declared MIME type (normalized).
 * @throws AppError when extension and MIME type disagree.
 */
export const assertFilenameMatchesMime = (fileName: string, contentType: AllowedImageMimeType): void => {
  const ext = extractExtension(fileName);
  const canonical = MIME_TO_CANONICAL_EXT[contentType];
  const acceptable =
    contentType === 'image/jpeg' ? new Set(['jpg', 'jpeg']) : new Set([canonical]);
  if (!ext || !acceptable.has(ext)) {
    throw new AppError(
      `fileName extension must match contentType (expected one of: ${[...acceptable].join(', ')})`,
      StatusCodes.BAD_REQUEST,
      4007,
    );
  }
};

/**
 * Builds a new stored object key: UUID + canonical extension for the MIME type.
 *
 * @param contentType - Allowed image MIME type.
 */
export const generateFileName = (contentType: AllowedImageMimeType): string => {
  return `${randomUUID()}.${MIME_TO_CANONICAL_EXT[contentType]}`;
};

/** Matches UUID v4 keys produced by `crypto.randomUUID()` plus allowed extensions. */
const FILE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp|pdf)$/i;

/**
 * Reports whether `key` has the exact shape of a server-generated flat upload key
 * (`{uuidv4}.{png|jpg|webp|pdf}`), i.e. matches {@link FILE_KEY_PATTERN}. The orphan-root-upload
 * sweep uses this as a hard gate so it only ever deletes files this server itself created via
 * {@link generateFileName}, never any other file that happens to sit in the uploads root.
 *
 * @param key - A bare object key (no folder segment).
 */
export const isGeneratedFileKey = (key: string): boolean => {
  return FILE_KEY_PATTERN.test(key);
};

/**
 * Sanitizes a vehicle registration number into a filesystem-safe folder segment (uppercased,
 * alphanumeric only). Falls back to `VEHICLE` when nothing usable remains.
 *
 * @param registrationNumber - Raw registration number (may contain spaces/punctuation).
 */
export const sanitizeRegistrationForPath = (registrationNumber: string | null | undefined): string => {
  const cleaned = (registrationNumber ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned : 'VEHICLE';
};

/**
 * Builds a per-process storage key `"{registration}_{processId}/{basename}"` from a flat upload key.
 * Both folder components are server-controlled (sanitized registration + UUID processId), and only
 * the trailing basename of `fileKey` is kept — so the result is always a single safe subfolder with
 * no traversal. If `fileKey` already contains a folder, it is treated as already-scoped and returned
 * unchanged (idempotent).
 *
 * @param registrationNumber - The process's vehicle registration number.
 * @param processId - The vehicle process UUID.
 * @param fileKey - The flat upload key (e.g. `"<uuid>.jpg"`).
 */
export const buildProcessScopedKey = (
  registrationNumber: string | null | undefined,
  processId: string,
  fileKey: string,
): string => {
  if (fileKey.includes('/')) {
    return fileKey;
  }
  const folder = `${sanitizeRegistrationForPath(registrationNumber)}_${processId}`;
  const base = fileKey.split('/').pop() ?? fileKey;
  return `${folder}/${base}`;
};

/**
 * Builds the per-process storage folder prefix `"{registration}_{processId}"` (NO trailing slash) —
 * the folder every document/photo of a process lives under. Reuses {@link sanitizeRegistrationForPath}
 * so it exactly matches the folder component of {@link buildProcessScopedKey}. Used to recursively
 * delete a process's whole upload folder on permanent delete / purge.
 *
 * @param registrationNumber - The process's vehicle registration number.
 * @param processId - The vehicle process UUID.
 */
export const buildProcessFolderPrefix = (
  registrationNumber: string | null | undefined,
  processId: string,
): string => {
  return `${sanitizeRegistrationForPath(registrationNumber)}_${processId}`;
};

/**
 * Validates `fileKey` path safety and format (UUID + allowed extension). Rejects
 * traversal, reserved names, and keys that do not match server-generated shape.
 *
 * @param fileKey - Key returned from the generate-upload endpoint.
 * @throws AppError when invalid.
 */
export const assertSafeFileKey = (fileKey: string): void => {
  const trimmed = fileKey.trim();
  if (
    trimmed !== fileKey ||
    trimmed.length === 0 ||
    trimmed.length > 200 ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('..') ||
    trimmed.toLowerCase() === '.htaccess'
  ) {
    throw new AppError('Invalid file key', StatusCodes.BAD_REQUEST, 4008);
  }
  if (!FILE_KEY_PATTERN.test(trimmed)) {
    throw new AppError('Invalid file key format', StatusCodes.BAD_REQUEST, 4008);
  }
};

/**
 * Ensures buffer size is within the configured limit.
 *
 * @param buffer - Raw body.
 * @throws AppError when empty or too large.
 */
export const assertWithinMaxImageSize = (buffer: Buffer): void => {
  if (!buffer || buffer.length === 0) {
    throw new AppError('Empty body', StatusCodes.BAD_REQUEST, 4009);
  }
  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    throw new AppError('File exceeds maximum size of 5MB', StatusCodes.REQUEST_TOO_LONG, 4130);
  }
};

/**
 * Verifies that the first bytes of the body match the declared image type (do not
 * trust `Content-Type` alone).
 *
 * @param buffer - Raw uploaded bytes.
 * @param mime - Normalized allowed MIME type.
 * @throws AppError when the payload does not match the expected signature.
 */
export const assertBufferMatchesDeclaredMime = (buffer: Buffer, mime: AllowedImageMimeType): void => {
  if (mime === 'image/png') {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < sig.length || !buffer.subarray(0, sig.length).equals(sig)) {
      throw new AppError('Body is not a valid PNG file', StatusCodes.BAD_REQUEST, 4010);
    }
    return;
  }
  if (mime === 'image/jpeg') {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new AppError('Body is not a valid JPEG file', StatusCodes.BAD_REQUEST, 4010);
    }
    return;
  }
  if (mime === 'application/pdf') {
    // "%PDF-" magic bytes (25 50 44 46 2D).
    const sig = Buffer.from('%PDF-', 'ascii');
    if (buffer.length < sig.length || !buffer.subarray(0, sig.length).equals(sig)) {
      throw new AppError('Body is not a valid PDF file', StatusCodes.BAD_REQUEST, 4010);
    }
    return;
  }
  if (mime === 'image/webp') {
    if (
      buffer.length < 12 ||
      buffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
      buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
    ) {
      throw new AppError('Body is not a valid WebP file', StatusCodes.BAD_REQUEST, 4010);
    }
  }
};
