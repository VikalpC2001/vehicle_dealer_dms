import { randomUUID } from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import { AppError } from './app-error';

/** MIME types permitted for direct image uploads. */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Union of allowed image MIME type literals. */
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const MIME_TO_CANONICAL_EXT: Record<AllowedImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
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
      'Unsupported or missing Content-Type; allowed: image/png, image/jpeg, image/webp',
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
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/i;

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
