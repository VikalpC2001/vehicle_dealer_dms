import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createDealerWiseUploadCategoryHandler,
  listDealerWiseUploadCategoriesHandler,
  listDealerWiseUploadCategoriesViewInStepHandler,
  getDealerWiseUploadCategoryByIdHandler,
  updateDealerWiseUploadCategoryHandler,
  deleteDealerWiseUploadCategoryHandler,
  updateDealerWiseUploadOrderRanksHandler,
} from '../controllers/dealer-wise-upload-category.controller';
import {
  createDealerWiseUploadCategorySchema,
  listDealerWiseUploadCategoriesSchema,
  listDealerWiseUploadCategoriesViewInStepSchema,
  getDealerWiseUploadCategoryByIdSchema,
  updateDealerWiseUploadCategorySchema,
  updateDealerWiseUploadOrderRanksSchema,
} from '../validations/dealer-wise-upload-category.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validate(createDealerWiseUploadCategorySchema),
  asyncHandler(createDealerWiseUploadCategoryHandler),
);

router.get(
  '/',
  validate(listDealerWiseUploadCategoriesSchema),
  asyncHandler(listDealerWiseUploadCategoriesHandler),
);

router.put(
  '/order',
  validate(updateDealerWiseUploadOrderRanksSchema),
  asyncHandler(updateDealerWiseUploadOrderRanksHandler),
);

router.get(
  '/view-in-step',
  validate(listDealerWiseUploadCategoriesViewInStepSchema),
  asyncHandler(listDealerWiseUploadCategoriesViewInStepHandler),
);

router.get(
  '/:id',
  validate(getDealerWiseUploadCategoryByIdSchema),
  asyncHandler(getDealerWiseUploadCategoryByIdHandler),
);

router.patch(
  '/:id',
  validate(updateDealerWiseUploadCategorySchema),
  asyncHandler(updateDealerWiseUploadCategoryHandler),
);

router.delete(
  '/:id',
  validate(getDealerWiseUploadCategoryByIdSchema),
  asyncHandler(deleteDealerWiseUploadCategoryHandler),
);

export default router;
