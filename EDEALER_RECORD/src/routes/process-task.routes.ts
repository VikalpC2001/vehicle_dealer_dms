import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createProcessTaskHandler,
  listProcessTasksHandler,
  listProcessTaskBoardHandler,
  listProcessTaskHistoryHandler,
  getProcessTaskByIdHandler,
  updateProcessTaskHandler,
  deleteProcessTaskHandler,
} from '../controllers/process-task.controller';
import {
  createProcessTaskSchema,
  listProcessTasksSchema,
  listProcessTaskBoardSchema,
  listProcessTaskHistorySchema,
  getProcessTaskByIdSchema,
  updateProcessTaskSchema,
  deleteProcessTaskSchema,
} from '../validations/process-task.validation';
import {
  listTaskCommentsHandler,
  createTaskCommentHandler,
  updateTaskCommentHandler,
  deleteTaskCommentHandler,
} from '../controllers/task-comment.controller';
import {
  listTaskCommentsSchema,
  createTaskCommentSchema,
  updateTaskCommentSchema,
  deleteTaskCommentSchema,
} from '../validations/task-comment.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate(listProcessTasksSchema), asyncHandler(listProcessTasksHandler));

router.get(
  '/board',
  validate(listProcessTaskBoardSchema),
  asyncHandler(listProcessTaskBoardHandler),
);

// Literal path — must precede `/:id` so it is not captured as an id.
router.get(
  '/history',
  validate(listProcessTaskHistorySchema),
  asyncHandler(listProcessTaskHistoryHandler),
);

router.post('/', validate(createProcessTaskSchema), asyncHandler(createProcessTaskHandler));

router.get('/:id', validate(getProcessTaskByIdSchema), asyncHandler(getProcessTaskByIdHandler));

router.patch('/:id', validate(updateProcessTaskSchema), asyncHandler(updateProcessTaskHandler));

router.delete('/:id', validate(deleteProcessTaskSchema), asyncHandler(deleteProcessTaskHandler));

// Per-task comment thread (dealer team ↔ managing agent). `/:id/comments` is a distinct pattern
// from `/:id`, so it does not collide with the task CRUD routes above.
router.get(
  '/:id/comments',
  validate(listTaskCommentsSchema),
  asyncHandler(listTaskCommentsHandler),
);
router.post(
  '/:id/comments',
  validate(createTaskCommentSchema),
  asyncHandler(createTaskCommentHandler),
);
router.patch(
  '/:id/comments/:commentId',
  validate(updateTaskCommentSchema),
  asyncHandler(updateTaskCommentHandler),
);
router.delete(
  '/:id/comments/:commentId',
  validate(deleteTaskCommentSchema),
  asyncHandler(deleteTaskCommentHandler),
);

export default router;
