import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  syncDealerTaskStatusesHandler,
  listDealerTaskStatusesForSessionHandler,
  getDealerTaskStatusesByDealerIdHandler,
  updateDealerTaskStatusOrderHandler,
} from '../controllers/dealer-task-status.controller';
import {
  syncDealerTaskStatusesSchema,
  listDealerTaskStatusesForSessionSchema,
  getDealerTaskStatusesByDealerIdSchema,
  updateDealerTaskStatusOrderSchema,
} from '../validations/dealer-task-status.validation';

const router = Router();

/** All dealer task status routes require a valid JWT. */
router.use(authenticate);

// Sync all task statuses for a dealer
router.post(
  '/',
  validate(syncDealerTaskStatusesSchema),
  asyncHandler(syncDealerTaskStatusesHandler),
);

// Update task status order for a dealer (must be before :dealerId so "order" is not captured)
router.put(
  '/order',
  validate(updateDealerTaskStatusOrderSchema),
  asyncHandler(updateDealerTaskStatusOrderHandler),
);

router.get(
  '/',
  validate(listDealerTaskStatusesForSessionSchema),
  asyncHandler(listDealerTaskStatusesForSessionHandler),
);

// Get task statuses by dealerId (path must match JWT dealer for non-admin)
router.get(
  '/:dealerId',
  validate(getDealerTaskStatusesByDealerIdSchema),
  asyncHandler(getDealerTaskStatusesByDealerIdHandler),
);

export default router;
