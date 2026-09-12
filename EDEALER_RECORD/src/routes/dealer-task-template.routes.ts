import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createDealerTaskTemplateHandler,
  listDealerTaskTemplatesHandler,
  getDealerTaskTemplateByIdHandler,
  updateDealerTaskTemplateHandler,
  deleteDealerTaskTemplateHandler,
} from '../controllers/dealer-task-template.controller';
import {
  createDealerTaskTemplateSchema,
  listDealerTaskTemplatesSchema,
  getDealerTaskTemplateByIdSchema,
  updateDealerTaskTemplateSchema,
} from '../validations/dealer-task-template.validation';

const router = Router();

/** All dealer task template routes require a valid JWT. */
router.use(authenticate);

router.post(
  '/',
  validate(createDealerTaskTemplateSchema),
  asyncHandler(createDealerTaskTemplateHandler),
);

router.get(
  '/',
  validate(listDealerTaskTemplatesSchema),
  asyncHandler(listDealerTaskTemplatesHandler),
);

router.get(
  '/:id',
  validate(getDealerTaskTemplateByIdSchema),
  asyncHandler(getDealerTaskTemplateByIdHandler),
);

router.patch(
  '/:id',
  validate(updateDealerTaskTemplateSchema),
  asyncHandler(updateDealerTaskTemplateHandler),
);

router.delete(
  '/:id',
  validate(getDealerTaskTemplateByIdSchema),
  asyncHandler(deleteDealerTaskTemplateHandler),
);

export default router;
