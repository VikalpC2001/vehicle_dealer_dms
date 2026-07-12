import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createDealerHandler,
  listDealersHandler,
  getDealerByIdHandler,
  updateDealerHandler,
  deleteDealerHandler,
} from '../controllers/dealer.controller';
import {
  createDealerSchema,
  listDealersSchema,
  getDealerByIdSchema,
  updateDealerSchema,
} from '../validations/dealer.validation';

const router = Router();

/** All dealer routes require a valid JWT. */
router.use(authenticate);

router.post(
  '/',
  validate(createDealerSchema),
  asyncHandler(createDealerHandler),
);

router.get(
  '/',
  validate(listDealersSchema),
  asyncHandler(listDealersHandler),
);

router.get(
  '/:id',
  validate(getDealerByIdSchema),
  asyncHandler(getDealerByIdHandler),
);

router.patch(
  '/:id',
  validate(updateDealerSchema),
  asyncHandler(updateDealerHandler),
);

router.delete(
  '/:id',
  validate(getDealerByIdSchema),
  asyncHandler(deleteDealerHandler),
);

export default router;
