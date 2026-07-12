import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createProcessTaskHandler,
  listProcessTasksHandler,
  getProcessTaskByIdHandler,
  updateProcessTaskHandler,
  deleteProcessTaskHandler,
} from '../controllers/process-task.controller';
import {
  createProcessTaskSchema,
  listProcessTasksSchema,
  getProcessTaskByIdSchema,
  updateProcessTaskSchema,
  deleteProcessTaskSchema,
} from '../validations/process-task.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate(listProcessTasksSchema), asyncHandler(listProcessTasksHandler));

router.post('/', validate(createProcessTaskSchema), asyncHandler(createProcessTaskHandler));

router.get('/:id', validate(getProcessTaskByIdSchema), asyncHandler(getProcessTaskByIdHandler));

router.patch('/:id', validate(updateProcessTaskSchema), asyncHandler(updateProcessTaskHandler));

router.delete('/:id', validate(deleteProcessTaskSchema), asyncHandler(deleteProcessTaskHandler));

export default router;
