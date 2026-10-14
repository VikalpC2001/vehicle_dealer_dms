import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createProcessUploadPhotoHandler,
  bulkCreateProcessUploadPhotosHandler,
  listProcessUploadPhotosHandler,
  getProcessUploadPhotoByIdHandler,
  updateProcessUploadPhotoHandler,
  setStarredVehiclePhotoHandler,
  deleteProcessUploadPhotoHandler,
} from '../controllers/process-upload-photo.controller';
import {
  createProcessUploadPhotoSchema,
  bulkCreateProcessUploadPhotosSchema,
  listProcessUploadPhotosSchema,
  getProcessUploadPhotoByIdSchema,
  updateProcessUploadPhotoSchema,
  starProcessUploadPhotoSchema,
  deleteProcessUploadPhotoSchema,
} from '../validations/process-upload-photo.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate(listProcessUploadPhotosSchema), asyncHandler(listProcessUploadPhotosHandler));

router.post(
  '/bulk',
  validate(bulkCreateProcessUploadPhotosSchema),
  asyncHandler(bulkCreateProcessUploadPhotosHandler),
);

router.post('/', validate(createProcessUploadPhotoSchema), asyncHandler(createProcessUploadPhotoHandler));

router.get(
  '/:id',
  validate(getProcessUploadPhotoByIdSchema),
  asyncHandler(getProcessUploadPhotoByIdHandler),
);

router.patch(
  '/:id',
  validate(updateProcessUploadPhotoSchema),
  asyncHandler(updateProcessUploadPhotoHandler),
);

router.patch(
  '/:id/star',
  validate(starProcessUploadPhotoSchema),
  asyncHandler(setStarredVehiclePhotoHandler),
);

router.delete(
  '/:id',
  validate(deleteProcessUploadPhotoSchema),
  asyncHandler(deleteProcessUploadPhotoHandler),
);

export default router;
