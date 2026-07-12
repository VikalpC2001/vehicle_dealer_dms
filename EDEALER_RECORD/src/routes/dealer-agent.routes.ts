import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  grantAgentHandler,
  listDealerAgentsHandler,
  revokeDealerAgentHandler,
} from '../controllers/dealer-agent.controller';
import {
  createDealerAgentSchema,
  dealerAgentIdParamsSchema,
} from '../validations/dealer-agent.validation';

const router = Router();

/** All dealer-agent routes require a valid JWT. */
router.use(authenticate);

// Grant agent-site access to an agent for the calling dealer
router.post('/', validate(createDealerAgentSchema), asyncHandler(grantAgentHandler));

// List the calling dealer's active agent grants
router.get('/', asyncHandler(listDealerAgentsHandler));

// Revoke a dealer-agent grant by id
router.delete(
  '/:id',
  validate(dealerAgentIdParamsSchema),
  asyncHandler(revokeDealerAgentHandler),
);

export default router;
