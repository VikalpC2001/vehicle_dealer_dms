import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createVehicleHandler,
  listVehiclesHandler,
  getVehicleByIdHandler,
  getVehicleHistoryHandler,
  updateVehicleHandler,
  deleteVehicleHandler,
} from '../controllers/vehicle.controller';
import {
  createVehicleSchema,
  listVehiclesSchema,
  getVehicleByIdSchema,
  vehicleHistorySchema,
  updateVehicleSchema,
} from '../validations/vehicle.validation';

const router = Router();

/** All vehicle routes require a valid JWT. */
router.use(authenticate);

router.post(
  '/',
  validate(createVehicleSchema),
  asyncHandler(createVehicleHandler),
);

router.get(
  '/',
  validate(listVehiclesSchema),
  asyncHandler(listVehiclesHandler),
);

// Literal route MUST be registered before '/:id' so it is not captured by the param route.
router.get(
  '/history',
  validate(vehicleHistorySchema),
  asyncHandler(getVehicleHistoryHandler),
);

router.get(
  '/:id',
  validate(getVehicleByIdSchema),
  asyncHandler(getVehicleByIdHandler),
);

router.patch(
  '/:id',
  validate(updateVehicleSchema),
  asyncHandler(updateVehicleHandler),
);

router.delete(
  '/:id',
  validate(getVehicleByIdSchema),
  asyncHandler(deleteVehicleHandler),
);

export default router;

