import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createAgentWiseUploadCategoryHandler,
  listAgentWiseUploadCategoriesHandler,
  listAgentWiseUploadCategoriesViewInStepHandler,
  getAgentWiseUploadCategoryByIdHandler,
  updateAgentWiseUploadCategoryHandler,
  deleteAgentWiseUploadCategoryHandler,
  updateAgentWiseUploadOrderRanksHandler,
} from '../controllers/agent-wise-upload-category.controller';
import {
  createAgentWiseUploadCategorySchema,
  listAgentWiseUploadCategoriesSchema,
  listAgentWiseUploadCategoriesViewInStepSchema,
  getAgentWiseUploadCategoryByIdSchema,
  updateAgentWiseUploadCategorySchema,
  updateAgentWiseUploadOrderRanksSchema,
} from '../validations/agent-wise-upload-category.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validate(createAgentWiseUploadCategorySchema),
  asyncHandler(createAgentWiseUploadCategoryHandler),
);

router.get(
  '/',
  validate(listAgentWiseUploadCategoriesSchema),
  asyncHandler(listAgentWiseUploadCategoriesHandler),
);

router.put(
  '/order',
  validate(updateAgentWiseUploadOrderRanksSchema),
  asyncHandler(updateAgentWiseUploadOrderRanksHandler),
);

router.get(
  '/view-in-step',
  validate(listAgentWiseUploadCategoriesViewInStepSchema),
  asyncHandler(listAgentWiseUploadCategoriesViewInStepHandler),
);

router.get(
  '/:id',
  validate(getAgentWiseUploadCategoryByIdSchema),
  asyncHandler(getAgentWiseUploadCategoryByIdHandler),
);

router.patch(
  '/:id',
  validate(updateAgentWiseUploadCategorySchema),
  asyncHandler(updateAgentWiseUploadCategoryHandler),
);

router.delete(
  '/:id',
  validate(getAgentWiseUploadCategoryByIdSchema),
  asyncHandler(deleteAgentWiseUploadCategoryHandler),
);

export default router;
