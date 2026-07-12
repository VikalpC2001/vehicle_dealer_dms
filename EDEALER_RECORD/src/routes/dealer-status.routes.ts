import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  syncDealerStatusesHandler,
  listDealerStatusesForSessionHandler,
  getDealerStatusesByDealerIdHandler,
  updateDealerStatusOrderHandler,
} from '../controllers/dealer-status.controller';
import {
  syncDealerStatusesSchema,
  listDealerStatusesForSessionSchema,
  getDealerStatusesByDealerIdSchema,
  updateDealerStatusOrderSchema,
} from '../validations/dealer-status.validation';

const router = Router();

/** All dealer status routes require a valid JWT. */
router.use(authenticate);

// Sync all statuses for a dealer
router.post(
  '/',
  validate(syncDealerStatusesSchema),
  asyncHandler(syncDealerStatusesHandler),
);

// Update status order for a dealer (must be before :dealerId so "order" is not captured)
router.put(
  '/order',
  validate(updateDealerStatusOrderSchema),
  asyncHandler(updateDealerStatusOrderHandler),
);

router.get(
  '/',
  validate(listDealerStatusesForSessionSchema),
  asyncHandler(listDealerStatusesForSessionHandler),
);

// Get statuses by dealerId (path must match JWT dealer for non-admin)
router.get(
  '/:dealerId',
  validate(getDealerStatusesByDealerIdSchema),
  asyncHandler(getDealerStatusesByDealerIdHandler),
);

export default router;
