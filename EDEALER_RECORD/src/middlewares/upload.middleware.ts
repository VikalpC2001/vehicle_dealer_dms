import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import multer from 'multer';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../utils/app-error';
import { MAX_IMAGE_UPLOAD_BYTES } from '../utils/file.utils';

const singleImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('Only image files are allowed', StatusCodes.BAD_REQUEST, 4004));
      return;
    }
    cb(null, true);
  },
}).single('image');

/**
 * Multer middleware for in-memory single image uploads.
 */
export const uploadSingleImage = (req: Request, res: Response, next: NextFunction): void => {
  singleImageUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        next(new AppError('Only one image is allowed', StatusCodes.BAD_REQUEST, 4005));
        return;
      }
    }
    next(error);
  });
};

/**
 * Parses the request body as a raw buffer (signed-URL-style PUT upload).
 * Limit matches {@link MAX_IMAGE_UPLOAD_BYTES}.
 */
export const uploadSignedPutRawParser = express.raw({
  type: () => true,
  limit: MAX_IMAGE_UPLOAD_BYTES,
});

/**
 * Ensures the signed PUT target received a binary buffer after `uploadSignedPutRawParser`.
 */
export const assertRawBinaryBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (!Buffer.isBuffer(req.body)) {
    next(new AppError('Expected raw binary body', StatusCodes.BAD_REQUEST, 4011));
    return;
  }
  next();
};
