import { Router } from 'express';

import {
  syncModulesHandler,
  syncPagesHandler,
  syncPageActionsHandler,
  getRbacCatalogHandler,
} from '../controllers/rbac-navigation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import {
  syncModulesSchema,
  syncPagesSchema,
  syncPageActionsSchema,
  getRbacCatalogSchema,
} from '../validations/rbac-navigation.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/catalog',
  validate(getRbacCatalogSchema),
  asyncHandler(getRbacCatalogHandler),
);

router.post(
  '/modules/sync',
  validate(syncModulesSchema),
  asyncHandler(syncModulesHandler),
);

router.post(
  '/pages/sync',
  validate(syncPagesSchema),
  asyncHandler(syncPagesHandler),
);

router.post(
  '/page-actions/sync',
  validate(syncPageActionsSchema),
  asyncHandler(syncPageActionsHandler),
);

export default router;
