import { z } from 'zod';
import { ALLOWED_IMAGE_MIME_TYPES } from '../utils/file.utils';

const contentTypeEnum = z.enum(ALLOWED_IMAGE_MIME_TYPES);

/** Validates POST /upload/generate JSON body. */
export const generateUploadSchema = z.object({
  body: z.object({
    fileName: z.string().min(1).max(255),
    contentType: contentTypeEnum,
  }),
});

/** Validates PUT /upload/file/:fileKey path param. */
export const putUploadFileSchema = z.object({
  params: z.object({
    fileKey: z.string().min(1).max(200),
  }),
});
