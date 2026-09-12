import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createDealerTagHandler,
  listDealerTagsHandler,
  updateDealerTagHandler,
  deleteDealerTagHandler,
} from '../controllers/dealer-tag.controller';
import {
  createDealerTagSchema,
  listDealerTagsSchema,
  updateDealerTagSchema,
  dealerTagIdSchema,
} from '../validations/dealer-tag.validation';

const router = Router();

/** All dealer tag routes require a valid JWT. */
router.use(authenticate);

router.post('/', validate(createDealerTagSchema), asyncHandler(createDealerTagHandler));

router.get('/', validate(listDealerTagsSchema), asyncHandler(listDealerTagsHandler));

router.patch('/:id', validate(updateDealerTagSchema), asyncHandler(updateDealerTagHandler));

router.delete('/:id', validate(dealerTagIdSchema), asyncHandler(deleteDealerTagHandler));

export default router;
