import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCapability } from '../utils/dealer-capabilities';
import {
  getCapabilityCatalogHandler,
  getMyCapabilitiesHandler,
  listDealerRolesHandler,
  createDealerRoleHandler,
  updateDealerRoleHandler,
  deleteDealerRoleHandler,
  assignDealerRoleHandler,
} from '../controllers/dealer-role.controller';
import {
  createDealerRoleSchema,
  updateDealerRoleSchema,
  dealerRoleIdParamsSchema,
  listDealerRolesSchema,
  assignDealerRoleSchema,
} from '../validations/dealer-role.validation';

const router = Router();

/** All dealer-role routes require a valid JWT. */
router.use(authenticate);

// Literal routes must precede '/:id' so they are not captured as an id.

// Read-only: any authenticated dealer user may read the catalog and their own capabilities.
router.get('/capabilities', getCapabilityCatalogHandler);
router.get('/me', asyncHandler(getMyCapabilitiesHandler));

// Assign a role to an employee (owner passes since owner holds every capability).
router.post(
  '/assign',
  requireCapability('roles.manage'),
  validate(assignDealerRoleSchema),
  asyncHandler(assignDealerRoleHandler),
);

// List / create roles.
router.get(
  '/',
  requireCapability('roles.manage'),
  validate(listDealerRolesSchema),
  asyncHandler(listDealerRolesHandler),
);
router.post(
  '/',
  requireCapability('roles.manage'),
  validate(createDealerRoleSchema),
  asyncHandler(createDealerRoleHandler),
);

// By-id ops.
router.patch(
  '/:id',
  requireCapability('roles.manage'),
  validate(updateDealerRoleSchema),
  asyncHandler(updateDealerRoleHandler),
);
router.delete(
  '/:id',
  requireCapability('roles.manage'),
  validate(dealerRoleIdParamsSchema),
  asyncHandler(deleteDealerRoleHandler),
);

export default router;
