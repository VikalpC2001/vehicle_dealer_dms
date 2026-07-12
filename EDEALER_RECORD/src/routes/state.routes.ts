import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createStateHandler,
  listStatesHandler,
  listStatesForDropdownHandler,
  getStateByIdHandler,
  updateStateHandler,
  deleteStateHandler,
} from '../controllers/state.controller';
import {
  createStateSchema,
  listStatesSchema,
  listStatesForDropdownSchema,
  getStateByIdSchema,
  updateStateSchema,
} from '../validations/state.validation';

const router = Router();

router.use(authenticate);

router.post('/', validate(createStateSchema), asyncHandler(createStateHandler));
router.get('/ddl', validate(listStatesForDropdownSchema), asyncHandler(listStatesForDropdownHandler));
router.get('/', validate(listStatesSchema), asyncHandler(listStatesHandler));
router.get('/:id', validate(getStateByIdSchema), asyncHandler(getStateByIdHandler));
router.patch('/:id', validate(updateStateSchema), asyncHandler(updateStateHandler));
router.delete('/:id', validate(getStateByIdSchema), asyncHandler(deleteStateHandler));

export default router;

