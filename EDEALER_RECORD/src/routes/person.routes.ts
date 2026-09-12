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
  changeBuyerHandler,
} from '../controllers/person.controller';
import {
  createPersonSchema,
  listPersonsSchema,
  getPersonByIdSchema,
  updatePersonSchema,
  deletePersonSchema,
  changeBuyerSchema,
} from '../validations/person.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate(listPersonsSchema), asyncHandler(listPersonsHandler));
router.post('/', validate(createPersonSchema), asyncHandler(createPersonHandler));
// Literal path — before `/:id` so "change-buyer" isn't captured as a person id.
router.post('/change-buyer', validate(changeBuyerSchema), asyncHandler(changeBuyerHandler));
router.get('/:id', validate(getPersonByIdSchema), asyncHandler(getPersonByIdHandler));
router.patch('/:id', validate(updatePersonSchema), asyncHandler(updatePersonHandler));
router.delete('/:id', validate(deletePersonSchema), asyncHandler(deletePersonHandler));

export default router;
