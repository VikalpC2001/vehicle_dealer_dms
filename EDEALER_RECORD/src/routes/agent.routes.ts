import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createAgentHandler,
  createAgentWithUserHandler,
  listAgentsHandler,
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
} from '../validations/agent.validation';

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

router.delete(
  '/:id',
  validate(getAgentByIdSchema),
  asyncHandler(deleteAgentHandler),
);

export default router;
