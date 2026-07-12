import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createVehicleProcessHandler,
  startVehicleProcessWithVehicleHandler,
  listVehicleProcessesHandler,
  getVehicleProcessByIdHandler,
  getVehicleProcessDetailsHandler,
  updateVehicleProcessHandler,
  deleteVehicleProcessHandler,
} from '../controllers/vehicle-process.controller';
import {
  createVehicleProcessSchema,
  startVehicleProcessWithVehicleSchema,
  listVehicleProcessesSchema,
  getVehicleProcessByIdSchema,
  getVehicleProcessDetailsSchema,
  updateVehicleProcessSchema,
} from '../validations/vehicle-process.validation';

const router = Router();

/** All vehicle-process routes require a valid JWT. */
router.use(authenticate);

router.post(
  '/start',
  validate(startVehicleProcessWithVehicleSchema),
  asyncHandler(startVehicleProcessWithVehicleHandler),
);

router.post('/', validate(createVehicleProcessSchema), asyncHandler(createVehicleProcessHandler));
router.get('/', validate(listVehicleProcessesSchema), asyncHandler(listVehicleProcessesHandler));
router.get(
  '/:id/details',
  validate(getVehicleProcessDetailsSchema),
  asyncHandler(getVehicleProcessDetailsHandler),
);
router.get('/:id', validate(getVehicleProcessByIdSchema), asyncHandler(getVehicleProcessByIdHandler));
router.patch('/:id', validate(updateVehicleProcessSchema), asyncHandler(updateVehicleProcessHandler));
router.delete('/:id', validate(getVehicleProcessByIdSchema), asyncHandler(deleteVehicleProcessHandler));

export default router;

