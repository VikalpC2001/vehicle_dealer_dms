import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  grantAgentHandler,
  listDealerAgentsHandler,
  revokeDealerAgentHandler,
  searchDealerAgentsHandler,
} from '../controllers/dealer-agent.controller';
import {
  switchPreviewHandler,
  switchAgentHandler,
} from '../controllers/dealer-agent-switch.controller';
import {
  createDealerAgentSchema,
  dealerAgentIdParamsSchema,
  searchDealerAgentsSchema,
} from '../validations/dealer-agent.validation';
import {
  switchPreviewSchema,
  switchAgentSchema,
} from '../validations/dealer-agent-switch.validation';

const router = Router();

/** All dealer-agent routes require a valid JWT. */
router.use(authenticate);

// Grant agent-site access to an agent for the calling dealer
router.post('/', validate(createDealerAgentSchema), asyncHandler(grantAgentHandler));

// Search agents the calling dealer could grant (literal route — before '/:id')
router.get(
  '/search',
  validate(searchDealerAgentsSchema),
  asyncHandler(searchDealerAgentsHandler),
);

// Preview a dealer's open work + ledger balance with an agent before switching
router.get(
  '/switch-preview',
  validate(switchPreviewSchema),
  asyncHandler(switchPreviewHandler),
);

// Atomically switch off an agent (optionally onto a replacement), settling or keeping the ledger
router.post('/switch', validate(switchAgentSchema), asyncHandler(switchAgentHandler));

// List the calling dealer's active agent grants
router.get('/', asyncHandler(listDealerAgentsHandler));

// Revoke a dealer-agent grant by id
router.delete(
  '/:id',
  validate(dealerAgentIdParamsSchema),
  asyncHandler(revokeDealerAgentHandler),
);

export default router;
