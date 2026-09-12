import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createPlaceholderHandler,
  listPlaceholdersHandler,
  updatePlaceholderHandler,
  deletePlaceholderHandler,
  connectPlaceholderHandler,
  connectPlaceholderAsAdminHandler,
  disconnectPlaceholderHandler,
} from '../controllers/placeholder-dealer.controller';
import {
  createPlaceholderSchema,
  updatePlaceholderSchema,
  placeholderIdParamsSchema,
  connectSchema,
} from '../validations/placeholder-dealer.validation';

const router = Router();

/** All placeholder-dealer routes require a valid JWT (caller is an agent). */
router.use(authenticate);

// Create a placeholder dealer
router.post(
  '/',
  validate(createPlaceholderSchema),
  asyncHandler(createPlaceholderHandler),
);

// List the calling agent's placeholder dealers
router.get('/', asyncHandler(listPlaceholdersHandler));

// Update a placeholder dealer's name fields
router.patch(
  '/:id',
  validate(updatePlaceholderSchema),
  asyncHandler(updatePlaceholderHandler),
);

// Delete a placeholder dealer (blocked if it has processes)
router.delete(
  '/:id',
  validate(placeholderIdParamsSchema),
  asyncHandler(deletePlaceholderHandler),
);

// Connect a placeholder dealer to a real subscribed dealer (agent, owned)
router.post(
  '/:id/connect',
  validate(connectSchema),
  asyncHandler(connectPlaceholderHandler),
);

// Super-admin: connect any agent's placeholder to a real subscribed dealer
router.post(
  '/:id/connect-admin',
  validate(connectSchema),
  asyncHandler(connectPlaceholderAsAdminHandler),
);

// Disconnect a placeholder dealer from its real dealer
router.post(
  '/:id/disconnect',
  validate(placeholderIdParamsSchema),
  asyncHandler(disconnectPlaceholderHandler),
);

export default router;
