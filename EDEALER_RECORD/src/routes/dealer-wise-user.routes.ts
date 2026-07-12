import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createDealerWiseUserHandler,
  createDealerWiseUserWithUserHandler,
  listDealerWiseUsersHandler,
  getDealerWiseUserByIdHandler,
  updateDealerWiseUserHandler,
  deleteDealerWiseUserHandler,
} from '../controllers/dealer-wise-user.controller';
import {
  createDealerWiseUserSchema,
  createDealerWiseUserWithUserSchema,
  listDealerWiseUsersSchema,
  dealerWiseUserIdParamsSchema,
  updateDealerWiseUserSchema,
} from '../validations/dealer-wise-user.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validate(createDealerWiseUserSchema),
  asyncHandler(createDealerWiseUserHandler),
);

// Static path before '/:id' so "with-user" is not captured as an id.
router.post(
  '/with-user',
  validate(createDealerWiseUserWithUserSchema),
  asyncHandler(createDealerWiseUserWithUserHandler),
);

router.get(
  '/',
  validate(listDealerWiseUsersSchema),
  asyncHandler(listDealerWiseUsersHandler),
);

router.get(
  '/:id',
  validate(dealerWiseUserIdParamsSchema),
  asyncHandler(getDealerWiseUserByIdHandler),
);

router.patch(
  '/:id',
  validate(updateDealerWiseUserSchema),
  asyncHandler(updateDealerWiseUserHandler),
);

router.delete(
  '/:id',
  validate(dealerWiseUserIdParamsSchema),
  asyncHandler(deleteDealerWiseUserHandler),
);

export default router;
