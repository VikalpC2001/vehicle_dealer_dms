import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createAgentHandler,
  createAgentWithUserHandler,
  listAgentsHandler,
  getMyAgentHandler,
  updateMyAgentHandler,
  getAgentByIdHandler,
  updateAgentHandler,
  deleteAgentHandler,
} from '../controllers/agent.controller';
import {
  createAgentSchema,
  createAgentWithUserSchema,
  listAgentsSchema,
  getAgentByIdSchema,
  updateAgentSchema,
  updateMyAgentSchema,
} from '../validations/agent.validation';
import { setAgentSubscriptionHandler } from '../controllers/subscription.controller';
import { setSubscriptionSchema } from '../validations/subscription.validation';
import { setAgentAccessHandler } from '../controllers/firm-access.controller';
import { setFirmAccessSchema } from '../validations/firm-access.validation';

const router = Router();

/** All agent routes require a valid JWT. */
router.use(authenticate);

router.post(
  '/',
  validate(createAgentSchema),
  asyncHandler(createAgentHandler),
);

router.post(
  '/with-user',
  validate(createAgentWithUserSchema),
  asyncHandler(createAgentWithUserHandler),
);

router.get(
  '/',
  validate(listAgentsSchema),
  asyncHandler(listAgentsHandler),
);

/**
 * Agent self-profile — resolved from the token, not a path id. Registered BEFORE `/:id` so `me`
 * is not captured as an agent id. `isSubscribe` is never editable here (super-admin's).
 */
router.get('/me', asyncHandler(getMyAgentHandler));
router.patch('/me', validate(updateMyAgentSchema), asyncHandler(updateMyAgentHandler));

router.get(
  '/:id',
  validate(getAgentByIdSchema),
  asyncHandler(getAgentByIdHandler),
);

router.patch(
  '/:id',
  validate(updateAgentSchema),
  asyncHandler(updateAgentHandler),
);

/** Super-admin: toggle an agent's subscription. */
router.patch(
  '/:id/subscription',
  validate(setSubscriptionSchema),
  asyncHandler(setAgentSubscriptionHandler),
);

/** Super-admin: pause/resume an agent's access (paused = no sign-in, live sessions rejected). */
router.patch(
  '/:id/access',
  validate(setFirmAccessSchema),
  asyncHandler(setAgentAccessHandler),
);

router.delete(
  '/:id',
  validate(getAgentByIdSchema),
  asyncHandler(deleteAgentHandler),
);

export default router;
