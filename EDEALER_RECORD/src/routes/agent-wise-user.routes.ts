import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createAgentWiseUserHandler,
  createAgentWiseUserWithUserHandler,
  listAgentWiseUsersHandler,
  getAgentWiseUserByIdHandler,
  updateAgentWiseUserHandler,
  deleteAgentWiseUserHandler,
} from '../controllers/agent-wise-user.controller';
import {
  createAgentWiseUserSchema,
  createAgentWiseUserWithUserSchema,
  listAgentWiseUsersSchema,
  agentWiseUserIdParamsSchema,
  updateAgentWiseUserSchema,
} from '../validations/agent-wise-user.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validate(createAgentWiseUserSchema),
  asyncHandler(createAgentWiseUserHandler),
);

// Static path before '/:id' so "with-user" is not captured as an id.
router.post(
  '/with-user',
  validate(createAgentWiseUserWithUserSchema),
  asyncHandler(createAgentWiseUserWithUserHandler),
);

router.get(
  '/',
  validate(listAgentWiseUsersSchema),
  asyncHandler(listAgentWiseUsersHandler),
);

router.get(
  '/:id',
  validate(agentWiseUserIdParamsSchema),
  asyncHandler(getAgentWiseUserByIdHandler),
);

router.patch(
  '/:id',
  validate(updateAgentWiseUserSchema),
  asyncHandler(updateAgentWiseUserHandler),
);

router.delete(
  '/:id',
  validate(agentWiseUserIdParamsSchema),
  asyncHandler(deleteAgentWiseUserHandler),
);

export default router;
