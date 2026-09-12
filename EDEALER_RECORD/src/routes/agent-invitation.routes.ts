import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createInvitationHandler,
  listInvitationsHandler,
  resendInvitationHandler,
  cancelInvitationHandler,
  getInvitationPrefillHandler,
  acceptInvitationHandler,
} from '../controllers/agent-invitation.controller';
import {
  createAgentInvitationSchema,
  agentInvitationIdParamsSchema,
  acceptInvitationTokenParamsSchema,
  acceptInvitationSchema,
} from '../validations/agent-invitation.validation';

const router = Router();

// ---- PUBLIC (no auth) — agent onboarding via a single-use invitation link ----
router.get(
  '/accept/:token',
  validate(acceptInvitationTokenParamsSchema),
  asyncHandler(getInvitationPrefillHandler),
);
router.post(
  '/accept/:token',
  validate(acceptInvitationSchema),
  asyncHandler(acceptInvitationHandler),
);

// ---- Dealer-authenticated invitation management ----
router.use(authenticate);

router.post('/', validate(createAgentInvitationSchema), asyncHandler(createInvitationHandler));
router.get('/', asyncHandler(listInvitationsHandler));
router.post(
  '/:id/resend',
  validate(agentInvitationIdParamsSchema),
  asyncHandler(resendInvitationHandler),
);
router.delete(
  '/:id',
  validate(agentInvitationIdParamsSchema),
  asyncHandler(cancelInvitationHandler),
);

export default router;
