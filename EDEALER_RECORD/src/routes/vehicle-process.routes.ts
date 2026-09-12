import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createVehicleProcessHandler,
  startVehicleProcessWithVehicleHandler,
  listVehicleProcessesHandler,
  listAgentBoardProcessesHandler,
  getVehicleProcessByIdHandler,
  getVehicleProcessDetailsHandler,
  updateVehicleProcessHandler,
  updateVehicleProcessAgentStatusHandler,
  setVehicleProcessReceiptHandler,
  deleteVehicleProcessReceiptHandler,
  setVehicleProcessTrackingHandler,
  setVehicleProcessStatusHandler,
  setVehicleProcessTagsHandler,
  deleteVehicleProcessHandler,
} from '../controllers/vehicle-process.controller';
import {
  createVehicleProcessSchema,
  startVehicleProcessWithVehicleSchema,
  listVehicleProcessesSchema,
  getVehicleProcessByIdSchema,
  getVehicleProcessDetailsSchema,
  updateVehicleProcessSchema,
  updateVehicleProcessAgentStatusSchema,
  setVehicleProcessReceiptSchema,
  setVehicleProcessTrackingSchema,
  setVehicleProcessStatusSchema,
  setVehicleProcessTagsSchema,
} from '../validations/vehicle-process.validation';
import {
  listProcessCommentsHandler,
  createProcessCommentHandler,
  updateProcessCommentHandler,
  deleteProcessCommentHandler,
} from '../controllers/process-comment.controller';
import {
  listProcessCommentsSchema,
  createProcessCommentSchema,
  updateProcessCommentSchema,
  deleteProcessCommentSchema,
} from '../validations/process-comment.validation';

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
// Literal path — must precede `/:id` so it is not captured as an id.
router.get('/agent-board', asyncHandler(listAgentBoardProcessesHandler));
router.get(
  '/:id/details',
  validate(getVehicleProcessDetailsSchema),
  asyncHandler(getVehicleProcessDetailsHandler),
);
router.get('/:id', validate(getVehicleProcessByIdSchema), asyncHandler(getVehicleProcessByIdHandler));
router.patch(
  '/:id/agent-status',
  validate(updateVehicleProcessAgentStatusSchema),
  asyncHandler(updateVehicleProcessAgentStatusHandler),
);
// Agent-only RTO receipt (PDF/image, dealer can download) + RC-book tracking number.
router.patch(
  '/:id/receipt',
  validate(setVehicleProcessReceiptSchema),
  asyncHandler(setVehicleProcessReceiptHandler),
);
router.delete(
  '/:id/receipt',
  validate(getVehicleProcessByIdSchema),
  asyncHandler(deleteVehicleProcessReceiptHandler),
);
router.patch(
  '/:id/tracking',
  validate(setVehicleProcessTrackingSchema),
  asyncHandler(setVehicleProcessTrackingHandler),
);
// Fixed lifecycle status (Sold/Complete/Scrap; null = open). Enforces one open process per vehicle.
router.patch(
  '/:id/status',
  validate(setVehicleProcessStatusSchema),
  asyncHandler(setVehicleProcessStatusHandler),
);
// Full-replace the process's tags (Finder-style labels).
router.put(
  '/:id/tags',
  validate(setVehicleProcessTagsSchema),
  asyncHandler(setVehicleProcessTagsHandler),
);
router.patch('/:id', validate(updateVehicleProcessSchema), asyncHandler(updateVehicleProcessHandler));
router.delete('/:id', validate(getVehicleProcessByIdSchema), asyncHandler(deleteVehicleProcessHandler));

// Shared, per-process comment thread (dealer owner ↔ assigned/managing agent).
router.get(
  '/:id/comments',
  validate(listProcessCommentsSchema),
  asyncHandler(listProcessCommentsHandler),
);
router.post(
  '/:id/comments',
  validate(createProcessCommentSchema),
  asyncHandler(createProcessCommentHandler),
);
router.patch(
  '/:id/comments/:commentId',
  validate(updateProcessCommentSchema),
  asyncHandler(updateProcessCommentHandler),
);
router.delete(
  '/:id/comments/:commentId',
  validate(deleteProcessCommentSchema),
  asyncHandler(deleteProcessCommentHandler),
);

export default router;

