import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createProcessExpenseHandler,
  listProcessExpensesHandler,
  getProcessExpenseByIdHandler,
  updateProcessExpenseHandler,
  deleteProcessExpenseHandler,
} from '../controllers/process-expense.controller';
import {
  createProcessExpenseSchema,
  listProcessExpensesSchema,
  updateProcessExpenseSchema,
  processExpenseIdSchema,
} from '../validations/process-expense.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate(listProcessExpensesSchema), asyncHandler(listProcessExpensesHandler));
router.post('/', validate(createProcessExpenseSchema), asyncHandler(createProcessExpenseHandler));
router.get('/:id', validate(processExpenseIdSchema), asyncHandler(getProcessExpenseByIdHandler));
router.patch('/:id', validate(updateProcessExpenseSchema), asyncHandler(updateProcessExpenseHandler));
router.delete('/:id', validate(processExpenseIdSchema), asyncHandler(deleteProcessExpenseHandler));

export default router;
