import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../utils/api-response';
import { uploadService } from '../services/upload.service';
import { resolveUploadPublicOrigin } from '../utils/request-origin';

/**
 * Issues a unique `fileKey` and URLs for direct PUT upload and public read.
 * Uses {@link resolveUploadPublicOrigin} so `localhost` is rewritten to the LAN IP when configured.
 */
export const generateUploadHandler = (req: Request, res: Response): Promise<void> => {
  const { fileName, contentType } = req.body as { fileName: string; contentType: string };
  const publicOrigin = resolveUploadPublicOrigin(req);
  const result = uploadService.generateUploadUrl(fileName, contentType, publicOrigin);
  sendSuccess(res, 'Upload URL created', result, StatusCodes.CREATED);
  return Promise.resolve();
};

/**
 * Accepts raw bytes for the given `fileKey` (cloud-style unsigned/signed PUT target).
 */
export const putUploadFileHandler = async (req: Request, res: Response): Promise<void> => {
  const { fileKey } = req.params;
  const publicOrigin = resolveUploadPublicOrigin(req);
  const payload = await uploadService.saveFile(
    req.body as Buffer,
    fileKey,
    req.get('content-type'),
    publicOrigin,
  );
  sendSuccess(res, 'File uploaded', payload, StatusCodes.CREATED);
};
