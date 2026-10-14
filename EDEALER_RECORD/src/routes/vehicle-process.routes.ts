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
  setVehicleProcessSoldDateHandler,
  setVehicleProcessTagsHandler,
  deleteVehicleProcessHandler,
  restoreVehicleProcessHandler,
  permanentlyDeleteVehicleProcessHandler,
  bulkRestoreProcessesHandler,
  bulkPermanentlyDeleteProcessesHandler,
  listBinProcessesHandler,
  listAgentBinProcessesHandler,
} from '../controllers/vehicle-process.controller';
import {
  createVehicleProcessSchema,
  startVehicleProcessWithVehicleSchema,
  listVehicleProcessesSchema,
  listBinProcessesSchema,
  bulkBinActionSchema,
  getVehicleProcessByIdSchema,
  getVehicleProcessDetailsSchema,
  updateVehicleProcessSchema,
  updateVehicleProcessAgentStatusSchema,
  setVehicleProcessReceiptSchema,
  setVehicleProcessTrackingSchema,
  setVehicleProcessStatusSchema,
  setVehicleProcessSoldDateSchema,
  setVehicleProcessTagsSchema,
} from '../validations/vehicle-process.validation';
import { exportProcessesHandler } from '../controllers/process-export.controller';
import { exportProcessesSchema } from '../validations/process-export.validation';
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
// Literal paths — must precede `/:id` so they are not captured as an id.
router.get('/agent-board', asyncHandler(listAgentBoardProcessesHandler));
// Export the dealer's processes over a date range as an Excel/PDF file (streams a binary download).
router.get('/export', validate(exportProcessesSchema), asyncHandler(exportProcessesHandler));
// Recycle bin: soft-deleted processes (auto-purged 7 days after deletion).
router.get('/bin', validate(listBinProcessesSchema), asyncHandler(listBinProcessesHandler));
// Agent-global recycle bin: the caller agent's binned processes across all placeholder dealers they own.
router.get('/agent-bin', validate(listBinProcessesSchema), asyncHandler(listAgentBinProcessesHandler));
// Bulk (multi-select) bin actions — literal `/bin/*` paths, kept before `/:id` so they aren't captured.
router.post(
  '/bin/restore',
  validate(bulkBinActionSchema),
  asyncHandler(bulkRestoreProcessesHandler),
);
router.post(
  '/bin/permanent-delete',
  validate(bulkBinActionSchema),
  asyncHandler(bulkPermanentlyDeleteProcessesHandler),
);
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
// Edit the recorded sold date of a sold process.
router.patch(
  '/:id/sold-date',
  validate(setVehicleProcessSoldDateSchema),
  asyncHandler(setVehicleProcessSoldDateHandler),
);
// Full-replace the process's tags (Finder-style labels).
router.put(
  '/:id/tags',
  validate(setVehicleProcessTagsSchema),
  asyncHandler(setVehicleProcessTagsHandler),
);
router.patch('/:id', validate(updateVehicleProcessSchema), asyncHandler(updateVehicleProcessHandler));
// Soft delete → recycle bin (kept 7 days). Restore, or permanently hard-delete, a binned process.
router.delete('/:id', validate(getVehicleProcessByIdSchema), asyncHandler(deleteVehicleProcessHandler));
router.post(
  '/:id/restore',
  validate(getVehicleProcessByIdSchema),
  asyncHandler(restoreVehicleProcessHandler),
);
router.delete(
  '/:id/permanent',
  validate(getVehicleProcessByIdSchema),
  asyncHandler(permanentlyDeleteVehicleProcessHandler),
);

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

