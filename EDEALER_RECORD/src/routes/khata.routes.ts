import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  listAccountsHandler,
  getStatementHandler,
  postEntryHandler,
  reverseEntryHandler,
  settleHandler,
} from '../controllers/khata.controller';
import {
  listAccountsSchema,
  statementSchema,
  postEntrySchema,
  entryIdParamsSchema,
  settleSchema,
} from '../validations/khata.validation';

const router = Router();

/** All khata routes require a valid JWT; the persona (dealer/agent) is read from the token. */
router.use(authenticate);

router.get('/accounts', validate(listAccountsSchema), asyncHandler(listAccountsHandler));
router.get(
  '/accounts/:counterpartyId/statement',
  validate(statementSchema),
  asyncHandler(getStatementHandler),
);
router.post('/accounts/:counterpartyId/settle', validate(settleSchema), asyncHandler(settleHandler));
router.post('/entries', validate(postEntrySchema), asyncHandler(postEntryHandler));
router.post('/entries/:id/reverse', validate(entryIdParamsSchema), asyncHandler(reverseEntryHandler));

export default router;
