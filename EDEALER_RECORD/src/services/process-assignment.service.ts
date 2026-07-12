import { StatusCodes } from 'http-status-codes';
import type { ProcessAssignment } from '@prisma/client';
import * as processAssignmentRepository from '../repositories/process-assignment.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import * as rtoServiceRepository from '../repositories/rto-service.repository';
import type {
  AssignmentDealerSummary,
  ProcessAssignmentDetailRow,
  ProcessAssignmentForAgent,
  ProcessAssignmentWithRelations,
  ProcessAssignmentWithServiceStatus,
} from '../repositories/process-assignment.repository';
import { getVehicleProcessDetails } from './vehicle-process.service';
import type { VehicleProcessDetailsDto } from './vehicle-process.service';
import { AppError } from '../utils/app-error';

/**
 * Fields a dealer supplies when assigning a vehicle process + RTO service to an agent.
 * `assignedByUserId` is resolved by the controller from the authenticated user.
 */
export interface CreateAssignmentInput {
  processId: string;
  agentId: string;
  serviceId: string;
  note?: string | null;
  assignedByUserId?: string | null;
}

/**
 * Loads the vehicle process and ensures it exists and belongs to `dealerId`.
 *
 * @throws AppError 404/4040 when the process is missing.
 * @throws AppError 403/4034 when the process belongs to a different dealer.
 */
const assertProcessOwnedByDealer = async (
  processId: string,
  dealerId: string,
): Promise<void> => {
  const process = await vehicleProcessRepository.findVehicleProcessById(processId);
  if (!process) {
    throw new AppError('Vehicle process not found', StatusCodes.NOT_FOUND, 4040);
  }
  if (!process.dealerId || process.dealerId !== dealerId) {
    throw new AppError(
      'You do not have access to this vehicle process',
      StatusCodes.FORBIDDEN,
      4034,
    );
  }
};

/**
 * Assigns a vehicle process + chosen RTO service to an agent for the given dealer.
 *
 * Validates that the process belongs to the dealer, that the dealer holds a live grant for the
 * agent, and that the RTO service exists. The default kanban column is the agent's
 * lowest-ranked status (or null). A duplicate assignment (same process + agent + service)
 * surfaces as Prisma `P2002`, mapped to 409/4090 by the global handler.
 *
 * @param dealerId - Resolved dealer scope.
 * @param input - Assignment fields (`assignedByUserId` resolved by the controller).
 * @throws AppError 404/4040 when the process or service is missing.
 * @throws AppError 403/4034 when the process belongs to another dealer.
 * @throws AppError 422/4228 when the dealer has not granted the agent access.
 */
export async function createAssignment(
  dealerId: string,
  input: CreateAssignmentInput,
): Promise<ProcessAssignmentWithRelations> {
  await assertProcessOwnedByDealer(input.processId, dealerId);

  const grant = await processAssignmentRepository.findActiveGrant(dealerId, input.agentId);
  if (!grant) {
    throw new AppError(
      'Grant the agent access before assigning',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4228,
    );
  }

  const service = await rtoServiceRepository.findRtoServiceById(input.serviceId);
  if (!service) {
    throw new AppError('RTO service not found', StatusCodes.NOT_FOUND, 4040);
  }

  const firstStatus = await processAssignmentRepository.findFirstAgentStatus(input.agentId);

  return processAssignmentRepository.createAssignment({
    processId: input.processId,
    dealerId,
    agentId: input.agentId,
    serviceId: input.serviceId,
    agentStatusId: firstStatus?.statusId ?? null,
    note: input.note ?? null,
    assignedByUserId: input.assignedByUserId ?? null,
  });
}

/**
 * Lists the non-cancelled assignments for a vehicle process owned by the dealer (oldest first).
 *
 * @param dealerId - Resolved dealer scope.
 * @param processId - Vehicle process UUID.
 * @throws AppError 404/4040 when the process is missing.
 * @throws AppError 403/4034 when the process belongs to another dealer.
 */
export async function listAssignmentsForProcess(
  dealerId: string,
  processId: string,
): Promise<ProcessAssignmentWithRelations[]> {
  await assertProcessOwnedByDealer(processId, dealerId);
  return processAssignmentRepository.listAssignmentsByProcess(processId);
}

/**
 * Cancels a single assignment owned by the dealer (sets status to `CANCELLED`).
 *
 * @param dealerId - Resolved dealer scope.
 * @param assignmentId - Assignment UUID.
 * @throws AppError 404/4040 when the assignment is missing.
 * @throws AppError 403/4034 when the assignment belongs to another dealer.
 */
export async function cancelAssignment(
  dealerId: string,
  assignmentId: string,
): Promise<ProcessAssignment> {
  const assignment = await processAssignmentRepository.findAssignmentById(assignmentId);
  if (!assignment) {
    throw new AppError('Assignment not found', StatusCodes.NOT_FOUND, 4040);
  }
  if (assignment.dealerId !== dealerId) {
    throw new AppError(
      'You do not have access to this assignment',
      StatusCodes.FORBIDDEN,
      4034,
    );
  }
  return processAssignmentRepository.setAssignmentStatus(assignmentId, 'CANCELLED');
}

/**
 * Aggregated agent-facing assignment detail: the assignment row (service + agent-status), the full
 * vehicle-process detail, and the source dealer summary.
 */
export interface AssignmentDetailResult {
  assignment: ProcessAssignmentDetailRow;
  process: VehicleProcessDetailsDto;
  dealer: AssignmentDealerSummary | null;
}

/**
 * Lists the agent's non-cancelled assignments (newest first), optionally filtered to one source
 * dealer. Each row carries its RTO service, agent kanban status, and the source process with its
 * vehicle registration number and source dealer summary.
 *
 * @param agentId - Resolved agent scope.
 * @param dealerId - Optional source-dealer UUID to filter by.
 */
export async function listAssignmentsForAgent(
  agentId: string,
  dealerId?: string,
): Promise<ProcessAssignmentForAgent[]> {
  return processAssignmentRepository.listAssignmentsForAgent(agentId, dealerId);
}

/**
 * Loads an assignment and returns it alongside the full vehicle-process detail (reusing
 * `getVehicleProcessDetails`) and the source dealer summary. The caller (controller) is responsible
 * for asserting the assignment belongs to the requesting agent via the returned `assignment.agentId`.
 *
 * @param assignmentId - Assignment UUID.
 * @param publicOrigin - Optional origin used to build local upload URLs in the process detail.
 * @throws AppError 404/4040 when the assignment is missing.
 */
export async function getAssignmentDetailForAgent(
  assignmentId: string,
  publicOrigin?: string,
): Promise<AssignmentDetailResult> {
  const assignment = await processAssignmentRepository.findAssignmentByIdRaw(assignmentId);
  if (!assignment) {
    throw new AppError('Assignment not found', StatusCodes.NOT_FOUND, 4040);
  }
  const process = await getVehicleProcessDetails(assignment.processId, publicOrigin);
  return {
    assignment,
    process,
    dealer: assignment.process.dealer,
  };
}

/**
 * Loads an assignment by ID (with service + agent-status + source dealer summaries) for an
 * agent-scoped operation. The caller (controller) asserts ownership via the returned `agentId`.
 *
 * @param assignmentId - Assignment UUID.
 * @throws AppError 404/4040 when the assignment is missing.
 */
export async function loadAssignmentForAgent(
  assignmentId: string,
): Promise<ProcessAssignmentDetailRow> {
  const assignment = await processAssignmentRepository.findAssignmentByIdRaw(assignmentId);
  if (!assignment) {
    throw new AppError('Assignment not found', StatusCodes.NOT_FOUND, 4040);
  }
  return assignment;
}

/**
 * Moves an assignment into one of the agent's own kanban statuses. Verifies the target status
 * belongs to the agent; does not change the assignment `status`. Ownership of the assignment itself
 * is asserted by the controller before this call.
 *
 * @param agentId - The assignment's owning agent (resolved from the caller's token).
 * @param assignmentId - Assignment UUID.
 * @param agentStatusId - Target agent status UUID.
 * @throws AppError 422/4229 when the status does not belong to the agent.
 */
export async function updateAssignmentAgentStatus(
  agentId: string,
  assignmentId: string,
  agentStatusId: string,
): Promise<ProcessAssignmentWithServiceStatus> {
  const status = await processAssignmentRepository.findAgentStatusForAgent(agentId, agentStatusId);
  if (!status) {
    throw new AppError(
      'Invalid status for this agent',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4229,
    );
  }
  return processAssignmentRepository.updateAssignmentAgentStatus(assignmentId, agentStatusId);
}
