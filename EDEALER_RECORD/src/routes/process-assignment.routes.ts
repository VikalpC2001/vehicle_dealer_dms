import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createAssignmentHandler,
  listAssignmentsHandler,
  cancelAssignmentHandler,
  updateAssignmentCostHandler,
  listAgentAssignmentsHandler,
  getAssignmentDetailsHandler,
  updateAgentStatusHandler,
} from '../controllers/process-assignment.controller';
import {
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  assignmentIdParamsSchema,
  updateAssignmentCostSchema,
  agentAssignmentsQuerySchema,
  updateAgentStatusSchema,
} from '../validations/process-assignment.validation';

const router = Router();

/** All process assignment routes require a valid JWT. */
router.use(authenticate);

router.post('/', validate(createAssignmentSchema), asyncHandler(createAssignmentHandler));

router.get('/', validate(listAssignmentsQuerySchema), asyncHandler(listAssignmentsHandler));

// Agent-scoped: literal `/agent` must precede any `/:id`-style route so it is not shadowed.
router.get(
  '/agent',
  validate(agentAssignmentsQuerySchema),
  asyncHandler(listAgentAssignmentsHandler),
);

router.get(
  '/:id/details',
  validate(assignmentIdParamsSchema),
  asyncHandler(getAssignmentDetailsHandler),
);

router.patch(
  '/:id/agent-status',
  validate(updateAgentStatusSchema),
  asyncHandler(updateAgentStatusHandler),
);

// Dealer-scoped: set/change/remove the agent cost recorded in the ledger for an assignment.
router.patch(
  '/:id/cost',
  validate(updateAssignmentCostSchema),
  asyncHandler(updateAssignmentCostHandler),
);

router.delete('/:id', validate(assignmentIdParamsSchema), asyncHandler(cancelAssignmentHandler));

export default router;
