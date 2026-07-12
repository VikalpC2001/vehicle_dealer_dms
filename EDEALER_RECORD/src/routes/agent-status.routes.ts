import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  syncAgentStatusesHandler,
  listAgentStatusesForSessionHandler,
  getAgentStatusesByAgentIdHandler,
  updateAgentStatusOrderHandler,
} from '../controllers/agent-status.controller';
import {
  syncAgentStatusesSchema,
  listAgentStatusesForSessionSchema,
  getAgentStatusesByAgentIdSchema,
  updateAgentStatusOrderSchema,
} from '../validations/agent-status.validation';

const router = Router();

/** All agent status routes require a valid JWT. */
router.use(authenticate);

// Sync all statuses for an agent
router.post(
  '/',
  validate(syncAgentStatusesSchema),
  asyncHandler(syncAgentStatusesHandler),
);

// Update status order for an agent (must be before :agentId so "order" is not captured)
router.put(
  '/order',
  validate(updateAgentStatusOrderSchema),
  asyncHandler(updateAgentStatusOrderHandler),
);

router.get(
  '/',
  validate(listAgentStatusesForSessionSchema),
  asyncHandler(listAgentStatusesForSessionHandler),
);

// Get statuses by agentId (path must match JWT agent for non-admin)
router.get(
  '/:agentId',
  validate(getAgentStatusesByAgentIdSchema),
  asyncHandler(getAgentStatusesByAgentIdHandler),
);

export default router;
