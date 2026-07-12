import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createRtoServiceHandler,
  listRtoServicesHandler,
  getRtoServiceByIdHandler,
  updateRtoServiceHandler,
  deleteRtoServiceHandler,
  updateOrderRanksHandler,
} from '../controllers/rto-service.controller';
import {
  createRtoServiceSchema,
  listRtoServicesSchema,
  getRtoServiceByIdSchema,
  updateRtoServiceSchema,
  updateOrderRanksSchema,
} from '../validations/rto-service.validation';

const router = Router();

/** All RTO service routes require a valid JWT in the Authorization header. */
router.use(authenticate);

// Create
router.post(
  '/',
  validate(createRtoServiceSchema),
  asyncHandler(createRtoServiceHandler),
);

// List (paginated)
router.get(
  '/',
  validate(listRtoServicesSchema),
  asyncHandler(listRtoServicesHandler),
);

// Update order ranks (must be before /:id so "order" is not captured as id)
router.put(
  '/order',
  validate(updateOrderRanksSchema),
  asyncHandler(updateOrderRanksHandler),
);

// Get by ID
router.get(
  '/:id',
  validate(getRtoServiceByIdSchema),
  asyncHandler(getRtoServiceByIdHandler),
);

// Update
router.patch(
  '/:id',
  validate(updateRtoServiceSchema),
  asyncHandler(updateRtoServiceHandler),
);

// Delete
router.delete(
  '/:id',
  validate(getRtoServiceByIdSchema),
  asyncHandler(deleteRtoServiceHandler),
);

export default router;

