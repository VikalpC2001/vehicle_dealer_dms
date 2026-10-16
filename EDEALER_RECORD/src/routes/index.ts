import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { readinessHandler } from '../controllers/health.controller';
import authRoutes from './auth.routes';
import rtoServiceRoutes from './rto-service.routes';
import dealerRoutes from './dealer.routes';
import dealerTaskStatusRoutes from './dealer-task-status.routes';
import dealerTaskTemplateRoutes from './dealer-task-template.routes';
import dealerTagRoutes from './dealer-tag.routes';
import dealerReferenceRoutes from './dealer-reference.routes';
import vehicleRoutes from './vehicle.routes';
import vehicleProcessRoutes from './vehicle-process.routes';
import personRoutes from './person.routes';
import processUploadPhotoRoutes from './process-upload-photo.routes';
import processTaskRoutes from './process-task.routes';
import processExpenseRoutes from './process-expense.routes';
import stateRoutes from './state.routes';
import cityRoutes from './city.routes';
import aiRoutes from './ai.routes';
import roleRoutes from './role.routes';
import rbacNavigationRoutes from './rbac-navigation.routes';
import uploadRoutes from './upload.routes';
import uploadCategoryRoutes from './upload-category.routes';
import dealerWiseUploadCategoryRoutes from './dealer-wise-upload-category.routes';
import dealerWiseUserRoutes from './dealer-wise-user.routes';
import dealerRoleRoutes from './dealer-role.routes';
import agentRoutes from './agent.routes';
import agentWiseUserRoutes from './agent-wise-user.routes';
import agentStatusRoutes from './agent-status.routes';
import agentWiseUploadCategoryRoutes from './agent-wise-upload-category.routes';
import dealerAgentRoutes from './dealer-agent.routes';
import agentInvitationRoutes from './agent-invitation.routes';
import processAssignmentRoutes from './process-assignment.routes';
import placeholderDealerRoutes from './placeholder-dealer.routes';
import khataRoutes from './khata.routes';
import registrationRoutes from './registration.routes';

const router = Router();

/** Health-check endpoint — useful for load balancers and monitoring. */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Readiness: the API can serve requests (its database answers). */
router.get('/health/ready', asyncHandler(readinessHandler));

router.use('/auth', authRoutes);
router.use('/rto-services', rtoServiceRoutes);
router.use('/dealers', dealerRoutes);
router.use('/dealer-task-statuses', dealerTaskStatusRoutes);
router.use('/dealer-task-templates', dealerTaskTemplateRoutes);
router.use('/dealer-tags', dealerTagRoutes);
router.use('/dealer-references', dealerReferenceRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/vehicle-processes', vehicleProcessRoutes);
router.use('/persons', personRoutes);
router.use('/process-upload-photos', processUploadPhotoRoutes);
router.use('/process-tasks', processTaskRoutes);
router.use('/process-expenses', processExpenseRoutes);
router.use('/states', stateRoutes);
router.use('/cities', cityRoutes);
router.use('/ai', aiRoutes);
router.use('/roles', roleRoutes);
router.use('/rbac', rbacNavigationRoutes);
router.use('/upload', uploadRoutes);
router.use('/upload-categories', uploadCategoryRoutes);
router.use('/dealer-wise-upload-categories', dealerWiseUploadCategoryRoutes);
router.use('/dealer-wise-users', dealerWiseUserRoutes);
router.use('/dealer-roles', dealerRoleRoutes);
router.use('/agents', agentRoutes);
router.use('/agent-wise-users', agentWiseUserRoutes);
router.use('/agent-statuses', agentStatusRoutes);
router.use('/agent-wise-upload-categories', agentWiseUploadCategoryRoutes);
router.use('/dealer-agents', dealerAgentRoutes);
router.use('/agent-invitations', agentInvitationRoutes);
router.use('/process-assignments', processAssignmentRoutes);
router.use('/placeholder-dealers', placeholderDealerRoutes);
router.use('/khata', khataRoutes);
router.use('/registrations', registrationRoutes);

export default router;
