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
import { raiseAgentSlotsHandler } from '../controllers/dealer-agent-slots.controller';
import { setDealerSubscriptionHandler } from '../controllers/subscription.controller';
import { setSubscriptionSchema } from '../validations/subscription.validation';
import {
  createDealerSchema,
  listDealersSchema,
  getDealerByIdSchema,
  updateDealerSchema,
} from '../validations/dealer.validation';
import { raiseAgentSlotsSchema } from '../validations/dealer-agent-slots.validation';

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

/** Super-admin: set/raise a dealer's active-agent slot limit (manual "addon"). */
router.patch(
  '/:id/agent-slots',
  validate(raiseAgentSlotsSchema),
  asyncHandler(raiseAgentSlotsHandler),
);

/** Super-admin: toggle a dealer's subscription. */
router.patch(
  '/:id/subscription',
  validate(setSubscriptionSchema),
  asyncHandler(setDealerSubscriptionHandler),
);

router.delete(
  '/:id',
  validate(getDealerByIdSchema),
  asyncHandler(deleteDealerHandler),
);

export default router;
