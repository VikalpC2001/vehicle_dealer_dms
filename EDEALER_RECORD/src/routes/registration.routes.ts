import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  selfRegisterHandler,
  listRegistrationsHandler,
  approveRegistrationHandler,
  rejectRegistrationHandler,
} from '../controllers/registration.controller';
import {
  selfRegisterSchema,
  listRegistrationsSchema,
  registrationActionParamsSchema,
  rejectRegistrationSchema,
} from '../validations/registration.validation';

const router = Router();

// --- PUBLIC — self-registration -------------------------------------------------------------------
router.post('/', validate(selfRegisterSchema), asyncHandler(selfRegisterHandler));

// --- SUPER-ADMIN — request queue (each handler asserts super-admin) --------------------------------
router.use(authenticate);
router.get('/', validate(listRegistrationsSchema), asyncHandler(listRegistrationsHandler));
router.post('/:kind/:id/approve', validate(registrationActionParamsSchema), asyncHandler(approveRegistrationHandler));
router.post('/:kind/:id/reject', validate(rejectRegistrationSchema), asyncHandler(rejectRegistrationHandler));

export default router;
