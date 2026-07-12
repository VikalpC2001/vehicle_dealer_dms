import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createRoleHandler,
  listRolesHandler,
  getRoleByIdHandler,
  updateRoleHandler,
  deleteRoleHandler,
} from '../controllers/role.controller';
import {
  createRoleSchema,
  listRolesSchema,
  getRoleByIdSchema,
  updateRoleSchema,
} from '../validations/role.validation';

const router = Router();

router.use(authenticate);

router.post('/', validate(createRoleSchema), asyncHandler(createRoleHandler));

router.get('/', validate(listRolesSchema), asyncHandler(listRolesHandler));

router.get('/:id', validate(getRoleByIdSchema), asyncHandler(getRoleByIdHandler));

router.patch('/:id', validate(updateRoleSchema), asyncHandler(updateRoleHandler));

router.delete('/:id', validate(getRoleByIdSchema), asyncHandler(deleteRoleHandler));

export default router;
