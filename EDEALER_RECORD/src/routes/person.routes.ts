import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createPersonHandler,
  listPersonsHandler,
  getPersonByIdHandler,
  updatePersonHandler,
  deletePersonHandler,
} from '../controllers/person.controller';
import {
  createPersonSchema,
  listPersonsSchema,
  getPersonByIdSchema,
  updatePersonSchema,
  deletePersonSchema,
} from '../validations/person.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate(listPersonsSchema), asyncHandler(listPersonsHandler));
router.post('/', validate(createPersonSchema), asyncHandler(createPersonHandler));
router.get('/:id', validate(getPersonByIdSchema), asyncHandler(getPersonByIdHandler));
router.patch('/:id', validate(updatePersonSchema), asyncHandler(updatePersonHandler));
router.delete('/:id', validate(deletePersonSchema), asyncHandler(deletePersonHandler));

export default router;
