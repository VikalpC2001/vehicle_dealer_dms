import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createUploadCategoryHandler,
  listUploadCategoriesHandler,
  getUploadCategoryByIdHandler,
  updateUploadCategoryHandler,
  deleteUploadCategoryHandler,
  updateUploadCategoryOrderRanksHandler,
} from '../controllers/upload-category.controller';
import {
  createUploadCategorySchema,
  listUploadCategoriesSchema,
  getUploadCategoryByIdSchema,
  updateUploadCategorySchema,
  updateUploadCategoryOrderRanksSchema,
} from '../validations/upload-category.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validate(createUploadCategorySchema),
  asyncHandler(createUploadCategoryHandler),
);

router.get(
  '/',
  validate(listUploadCategoriesSchema),
  asyncHandler(listUploadCategoriesHandler),
);

router.put(
  '/order',
  validate(updateUploadCategoryOrderRanksSchema),
  asyncHandler(updateUploadCategoryOrderRanksHandler),
);

router.get(
  '/:id',
  validate(getUploadCategoryByIdSchema),
  asyncHandler(getUploadCategoryByIdHandler),
);

router.patch(
  '/:id',
  validate(updateUploadCategorySchema),
  asyncHandler(updateUploadCategoryHandler),
);

router.delete(
  '/:id',
  validate(getUploadCategoryByIdSchema),
  asyncHandler(deleteUploadCategoryHandler),
);

export default router;
