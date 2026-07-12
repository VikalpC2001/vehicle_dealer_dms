import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createDealerReferenceHandler,
  listDealerReferencesHandler,
  listDealerReferencesForDropdownHandler,
  getDealerReferenceByIdHandler,
  updateDealerReferenceHandler,
  deleteDealerReferenceHandler,
} from '../controllers/dealer-reference.controller';
import {
  createDealerReferenceSchema,
  listDealerReferencesSchema,
  listDealerReferencesForDropdownSchema,
  getDealerReferenceByIdSchema,
  updateDealerReferenceSchema,
} from '../validations/dealer-reference.validation';

const router = Router();

/** All dealer reference routes require a valid JWT. */
router.use(authenticate);

router.post(
  '/',
  validate(createDealerReferenceSchema),
  asyncHandler(createDealerReferenceHandler),
);

router.get(
  '/ddl',
  validate(listDealerReferencesForDropdownSchema),
  asyncHandler(listDealerReferencesForDropdownHandler),
);

router.get(
  '/',
  validate(listDealerReferencesSchema),
  asyncHandler(listDealerReferencesHandler),
);

router.get(
  '/:id',
  validate(getDealerReferenceByIdSchema),
  asyncHandler(getDealerReferenceByIdHandler),
);

router.patch(
  '/:id',
  validate(updateDealerReferenceSchema),
  asyncHandler(updateDealerReferenceHandler),
);

router.delete(
  '/:id',
  validate(getDealerReferenceByIdSchema),
  asyncHandler(deleteDealerReferenceHandler),
);

export default router;

