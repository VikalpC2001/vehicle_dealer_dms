import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import {
  assertRawBinaryBody,
  uploadSignedPutRawParser,
} from '../middlewares/upload.middleware';
import { generateUploadHandler, putUploadFileHandler } from '../controllers/upload.controller';
import { generateUploadSchema, putUploadFileSchema } from '../validations/upload.validation';

const router = Router();

router.post(
  '/generate',
  validate(generateUploadSchema),
  asyncHandler(generateUploadHandler),
);
router.put(
  '/file/:fileKey',
  validate(putUploadFileSchema),
  uploadSignedPutRawParser,
  assertRawBinaryBody,
  asyncHandler(putUploadFileHandler),
);

export default router;
