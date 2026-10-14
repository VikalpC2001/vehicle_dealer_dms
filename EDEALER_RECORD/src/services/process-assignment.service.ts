import { StatusCodes } from 'http-status-codes';
import type { DealerAgentStatus, LedgerEntry, ProcessAssignment } from '@prisma/client';
import * as processAssignmentRepository from '../repositories/process-assignment.repository';
import * as khataRepository from '../repositories/khata.repository';
import * as vehicleProcessRepository from '../repositories/vehicle-process.repository';
import * as rtoServiceRepository from '../repositories/rto-service.repository';
import * as dealerAgentRepository from '../repositories/dealer-agent.repository';
import * as agentStatusRepository from '../repositories/agent-status.repository';
import type {
  AssignmentDealerSummary,
  ProcessAssignmentDetailRow,
  ProcessAssignmentForAgent,
  ProcessAssignmentForDealerAgent,
  ProcessAssignmentWithRelations,
  ProcessAssignmentWithServiceStatus,
} from '../repositories/process-assignment.repository';
import type {
  DealerAgentGrantAgentSummary,
  DealerAgentWithAgent,
} from '../repositories/dealer-agent.repository';
import type { ProcessTagDto } from '../repositories/process-tag.repository';
import { getVehicleProcessDetails } from './vehicle-process.service';
import type { VehicleProcessDetailsDto } from './vehicle-process.service';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginatedResult, PaginationQuery } from '../types';

/**
 * Fields a dealer supplies when assigning a vehicle process + one or more RTO services to an agent.
 * One assignment is created per service. `assignedByUserId` is resolved by the controller from the
 * authenticated user. The optional `cost`/`costDate`/`costNote` record money the dealer owes the
 * agent, applied per service, in the ledger.
 */
export interface CreateAssignmentsInput {
  processId: string;
  agentId: string;
  serviceIds: string[];
  note?: string | null;
  assignedByUserId?: string | null;
  cost?: number | null;
  costDate?: Date | null;
  costNote?: string | null;
}

/** Serializable summary of an assignment's live ledger cost (Decimal → number). */
export interface AssignmentCostDto {
  ledgerEntryId: string;
  amount: number;
  entryDate: Date;
  description: string | null;
}

/** An assignment with its live agent cost attached (`null` when no cost is recorded). */
export type AssignmentWithCost = ProcessAssignmentWithRelations & { cost: AssignmentCostDto | null };

/** Maps a ledger entry to the compact cost DTO (or `null`). */
function toCostDto(entry: LedgerEntry | null): AssignmentCostDto | null {
  if (!entry) return null;
  return {
    ledgerEntryId: entry.ledgerEntryId,
    amount: entry.amount.toNumber(),
    entryDate: entry.entryDate,
    description: entry.description,
  };
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

/** The clear, actionable conflict when the (process, agent, service) triple is already live (4230). */
const alreadyAssignedError = (): AppError =>
  new AppError(
    'This process is already assigned to this agent for that service. Open that assignment to add or change its cost.',
    StatusCodes.UNPROCESSABLE_ENTITY,
    4230,
  );

/** The created assignment rows plus the services skipped because they were already actively assigned. */
export interface CreateAssignmentsResult {
  created: ProcessAssignmentWithRelations[];
  skippedServiceIds: string[];
}

/**
 * Assigns a vehicle process + one or more RTO services to an agent for the given dealer, creating
 * ONE assignment per service atomically. Validates the process belongs to the dealer, the dealer
 * holds a live grant, and every requested service exists. Services already actively assigned to that
 * agent for the process are skipped (a CANCELLED one is reactivated). The default kanban column is
 * the agent's lowest-ranked status. An optional `cost` is posted per created service.
 *
 * @param dealerId - Resolved dealer scope.
 * @param input - Assignment fields incl. `serviceIds[]` (`assignedByUserId` resolved by the controller).
 * @throws AppError 404/4040 when the process or any service is missing.
 * @throws AppError 403/4034 when the process belongs to another dealer.
 * @throws AppError 422/4228 when the dealer has not granted the agent access.
 * @throws AppError 422/4230 when EVERY requested service is already assigned.
 */
export async function createAssignments(
  dealerId: string,
  input: CreateAssignmentsInput,
): Promise<CreateAssignmentsResult> {
  await assertProcessOwnedByDealer(input.processId, dealerId);

  const grant = await processAssignmentRepository.findActiveGrant(dealerId, input.agentId);
  if (!grant) {
    throw new AppError(
      'Grant the agent access before assigning',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4228,
    );
  }

  const serviceIds = [...new Set(input.serviceIds)];

  // Every requested service must exist.
  for (const serviceId of serviceIds) {
    const service = await rtoServiceRepository.findRtoServiceById(serviceId);
    if (!service) {
      throw new AppError('RTO service not found', StatusCodes.NOT_FOUND, 4040);
    }
  }

  // Split into services to create vs. already-active ones to skip. A CANCELLED triple is NOT skipped
  // (the upsert reactivates it); a still-live one is skipped so the batch never trips 4230/P2002.
  const toCreate: string[] = [];
  const skippedServiceIds: string[] = [];
  for (const serviceId of serviceIds) {
    const existing = await processAssignmentRepository.findAssignmentByTriple(
      input.processId,
      input.agentId,
      serviceId,
    );
    if (existing && existing.status !== 'CANCELLED') {
      skippedServiceIds.push(serviceId);
    } else {
      toCreate.push(serviceId);
    }
  }

  // Nothing new to assign — every requested service is already live. Surface the clear conflict.
  if (toCreate.length === 0) {
    throw alreadyAssignedError();
  }

  const firstStatus = await processAssignmentRepository.findFirstAgentStatus(input.agentId);

  // The assignments + (optional per-service) cost CREDITs post atomically in one transaction. The
  // 4228 grant check above is the same guard the ledger requires, so cost posts are not re-guarded.
  try {
    const created = await processAssignmentRepository.createManyAssignmentsWithCost({
      assignments: toCreate.map((serviceId) => ({
        processId: input.processId,
        dealerId,
        agentId: input.agentId,
        serviceId,
        agentStatusId: firstStatus?.statusId ?? null,
        note: input.note ?? null,
        assignedByUserId: input.assignedByUserId ?? null,
      })),
      cost:
        input.cost && input.cost > 0
          ? {
              amount: input.cost,
              entryDate: input.costDate ?? null,
              description: input.costNote ?? 'Agent cost',
            }
          : null,
      postedByUserId: input.assignedByUserId ?? null,
    });
    return { created, skippedServiceIds };
  } catch (err) {
    // The pre-check and the upsert are not atomic; a concurrent identical create can still trip the
    // unique constraint (P2002). Re-map it to the same clear 4230 rather than the generic 4090.
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') {
      throw alreadyAssignedError();
    }
    throw err;
  }
}

/**
 * Sets/changes/removes the agent cost recorded in the ledger for an assignment the dealer owns.
 * Editing the amount posts a ledger reversal + new entry (append-only, preserving history); editing
 * only the date/note updates the entry in place. See
 * {@link processAssignmentRepository.updateAssignmentCost} for the exact branching.
 *
 * @param dealerId - Resolved dealer scope.
 * @param assignmentId - Assignment UUID.
 * @param input - `cost` (positive to set, `null` to remove, omitted to keep) + optional date/note.
 * @throws AppError 404/4040 when the assignment is missing.
 * @throws AppError 403/4034 when the assignment belongs to another dealer.
 */
export async function updateAssignmentCost(
  dealerId: string,
  assignmentId: string,
  input: { cost?: number | null; costDate?: Date | null; costNote?: string | null; userId?: string | null },
): Promise<AssignmentCostDto | null> {
  const assignment = await processAssignmentRepository.findAssignmentById(assignmentId);
  if (!assignment) {
    throw new AppError('Assignment not found', StatusCodes.NOT_FOUND, 4040);
  }
  if (assignment.dealerId !== dealerId) {
    throw new AppError('You do not have access to this assignment', StatusCodes.FORBIDDEN, 4034);
  }

  const { costEntry } = await processAssignmentRepository.updateAssignmentCost({
    dealerId,
    agentId: assignment.agentId,
    assignmentId,
    amount: input.cost,
    entryDate: input.costDate,
    description: input.costNote,
    postedByUserId: input.userId ?? null,
  });
  return toCostDto(costEntry);
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
): Promise<AssignmentWithCost[]> {
  await assertProcessOwnedByDealer(processId, dealerId);
  const assignments = await processAssignmentRepository.listAssignmentsByProcess(processId);
  const costByAssignment = await khataRepository.listActiveCostEntriesForAssignments(
    assignments.map((a) => a.assignmentId),
  );
  return assignments.map((a) => ({
    ...a,
    cost: toCostDto(costByAssignment.get(a.assignmentId) ?? null),
  }));
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
 * Agent-list assignment row with the source process's tags flattened to the shared
 * `{ tagId, tagName, colour }` shape under `process.tags` (all existing fields kept).
 */
export type ProcessAssignmentForAgentDto = Omit<ProcessAssignmentForAgent, 'process'> & {
  process: Omit<ProcessAssignmentForAgent['process'], 'processTags'> & {
    tags: ProcessTagDto[];
  };
};

/** Flattens an agent-list row's nested ProcessTag join rows into `process.tags` (existing fields kept). */
const toAgentAssignmentDto = (row: ProcessAssignmentForAgent): ProcessAssignmentForAgentDto => {
  const { processTags, ...restProcess } = row.process;
  return { ...row, process: { ...restProcess, tags: processTags.map((pt) => pt.tag) } };
};

/**
 * Lists the agent's non-cancelled assignments (newest first), optionally filtered to one source
 * dealer. Each row carries its RTO service, agent kanban status, and the source process with its
 * vehicle registration number, source dealer summary, and tags (flat `{ tagId, tagName, colour }`).
 *
 * @param agentId - Resolved agent scope.
 * @param dealerId - Optional source-dealer UUID to filter by.
 */
export async function listAssignmentsForAgent(
  agentId: string,
  dealerId?: string,
): Promise<ProcessAssignmentForAgentDto[]> {
  const rows = await processAssignmentRepository.listAssignmentsForAgent(agentId, dealerId);
  return rows.map(toAgentAssignmentDto);
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

/**
 * One row of a dealer's "work given to this agent" list: the assignment with its RTO service, the
 * agent's own kanban status, the live ledger `cost` (or `null`), and the source process — vehicle,
 * lifecycle status, deal number, the agent-entered RC-book tracking number, whether the agent has
 * uploaded an RTO receipt (`hasReceipt`; the file itself is served by the process detail), and tags.
 */
export type DealerAgentAssignmentDto = Omit<ProcessAssignmentForDealerAgent, 'process'> & {
  cost: AssignmentCostDto | null;
  process: Omit<ProcessAssignmentForDealerAgent['process'], 'processTags' | 'receiptImageName'> & {
    hasReceipt: boolean;
    tags: ProcessTagDto[];
  };
};

/** How many of the pair's live assignments sit in one of the agent's kanban statuses. */
export interface DealerAgentStatusCount {
  /** The agent status UUID, or `null` for the "no status yet" bucket. */
  statusId: string | null;
  statusName: string;
  colour: string | null;
  count: number;
}

/**
 * Totals for the work a dealer has given one agent, plus who the agent is and whether the grant is
 * still live. `byStatus` follows the agent's own board order and lists every status (zero counts
 * included); a trailing "No status" bucket appears only when some assignment has no status.
 */
export interface DealerAgentAssignmentSummary {
  agent: DealerAgentGrantAgentSummary;
  grantStatus: DealerAgentStatus;
  totals: {
    /** Live assignments (one per process + service). */
    assignments: number;
    /** Distinct vehicle processes those assignments belong to. */
    processes: number;
    /** Assignments that carry a live ledger cost. */
    costedAssignments: number;
    /** Sum of those live costs. */
    totalCost: number;
  };
  byStatus: DealerAgentStatusCount[];
}

/** Label of the bucket for assignments the agent has not put in any status yet. */
const NO_STATUS_LABEL = 'No status';

/**
 * Loads the dealer's grant for the agent (ACTIVE or REVOKED), with the agent summary.
 *
 * A dealer may only look at an agent they have (or had) a grant with. Every assignment needs a
 * grant to be created and grants are never deleted, so this also covers "has assigned work".
 *
 * @throws AppError 404/4044 when the dealer has never granted access to that agent.
 */
const loadDealerAgentGrant = async (
  dealerId: string,
  agentId: string,
): Promise<DealerAgentWithAgent> => {
  const grant = await dealerAgentRepository.findDealerAgentWithAgent(dealerId, agentId);
  if (!grant) {
    throw new AppError('Agent not found', StatusCodes.NOT_FOUND, 4044);
  }
  return grant;
};

/** Maps a repository row to the dealer-agent list DTO (tags flattened, receipt key hidden). */
const toDealerAgentAssignmentDto = (
  row: ProcessAssignmentForDealerAgent,
  cost: AssignmentCostDto | null,
): DealerAgentAssignmentDto => {
  const { processTags, receiptImageName, ...restProcess } = row.process;
  return {
    ...row,
    cost,
    process: {
      ...restProcess,
      hasReceipt: Boolean(receiptImageName),
      tags: processTags.map((pt) => pt.tag),
    },
  };
};

/**
 * Lists one page of the live work a dealer has given an agent (newest first): each assignment with
 * its RTO service, the agent's kanban status, the live ledger cost, and the source process summary.
 * CANCELLED assignments and assignments whose process is in the recycle bin are left out.
 *
 * @param dealerId - Resolved dealer scope.
 * @param agentId - The agent whose assigned work to list.
 * @param query - `page` / `limit` plus the optional `search` and `agentStatusId` filters.
 * @throws AppError 404/4044 when the dealer has never granted access to that agent.
 */
export async function listAssignmentsForDealerAgent(
  dealerId: string,
  agentId: string,
  query: PaginationQuery & { search?: string | null; agentStatusId?: string | null },
): Promise<PaginatedResult<DealerAgentAssignmentDto>> {
  await loadDealerAgentGrant(dealerId, agentId);

  const { items, total } = await processAssignmentRepository.listAssignmentsForDealerAgent(
    { dealerId, agentId, search: query.search ?? null, agentStatusId: query.agentStatusId ?? null },
    parsePagination(query),
  );
  const costByAssignment = await khataRepository.listActiveCostEntriesForAssignments(
    items.map((a) => a.assignmentId),
  );
  return {
    data: items.map((a) =>
      toDealerAgentAssignmentDto(a, toCostDto(costByAssignment.get(a.assignmentId) ?? null)),
    ),
    meta: buildPaginationMeta(total, query),
  };
}

/**
 * Summarises ALL the live work a dealer has given an agent (independent of any list filter or
 * page): who the agent is, whether the grant is still live, how many assignments and distinct
 * vehicle processes there are, the total of the live ledger costs, and a count per agent status.
 *
 * @param dealerId - Resolved dealer scope.
 * @param agentId - The agent whose assigned work to summarise.
 * @throws AppError 404/4044 when the dealer has never granted access to that agent.
 */
export async function getDealerAgentAssignmentSummary(
  dealerId: string,
  agentId: string,
): Promise<DealerAgentAssignmentSummary> {
  const grant = await loadDealerAgentGrant(dealerId, agentId);

  const [keys, statuses] = await Promise.all([
    processAssignmentRepository.listAssignmentKeysForDealerAgent(dealerId, agentId),
    agentStatusRepository.listAllAgentStatusesForAgent(agentId),
  ]);
  const cost = await khataRepository.sumActiveCostsForAssignments(keys.map((k) => k.assignmentId));

  // A status the agent deleted between the two reads above is no longer in `statuses`: count its
  // assignments under "No status" (where the database puts them), so the counts always add up.
  const knownStatusIds = new Set(statuses.map((s) => s.statusId));
  const countByStatus = new Map<string | null, number>();
  for (const key of keys) {
    const id = key.agentStatusId && knownStatusIds.has(key.agentStatusId) ? key.agentStatusId : null;
    countByStatus.set(id, (countByStatus.get(id) ?? 0) + 1);
  }
  const byStatus: DealerAgentStatusCount[] = statuses.map((s) => ({
    statusId: s.statusId,
    statusName: s.statusName,
    colour: s.colour,
    count: countByStatus.get(s.statusId) ?? 0,
  }));
  const withoutStatus = countByStatus.get(null) ?? 0;
  if (withoutStatus > 0) {
    byStatus.push({ statusId: null, statusName: NO_STATUS_LABEL, colour: null, count: withoutStatus });
  }

  return {
    agent: grant.agent,
    grantStatus: grant.status,
    totals: {
      assignments: keys.length,
      processes: new Set(keys.map((k) => k.processId)).size,
      costedAssignments: cost.count,
      totalCost: cost.total,
    },
    byStatus,
  };
}
