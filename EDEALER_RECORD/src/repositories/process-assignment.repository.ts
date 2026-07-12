import { prisma } from '../config/prisma';
import type {
  AgentStatus,
  AssignmentStatus,
  DealerAgent,
  ProcessAssignment,
} from '@prisma/client';

/**
 * Nested relations returned alongside a process assignment for list/detail views:
 * the agent summary, the chosen RTO service, and the optional agent kanban status.
 */
export type ProcessAssignmentWithRelations = ProcessAssignment & {
  agent: {
    agentId: string;
    firmName: string;
    agentName: string;
    displayName: string;
  };
  service: {
    serviceId: string;
    serviceName: string;
    shortName: string;
  };
  agentStatus: {
    statusId: string;
    statusName: string;
    colour: string | null;
  } | null;
};

/**
 * Source-dealer summary nested on agent-facing assignment rows. The dealer may be a real
 * subscribed dealer or an agent-created placeholder (`isPlaceholder = true`).
 */
export type AssignmentDealerSummary = {
  dealerId: string;
  firmName: string;
  dealerName: string;
  isPlaceholder: boolean;
};

/**
 * Assignment shape for the agent's dealer-wise list: the chosen RTO service, the optional agent
 * kanban status, and the source vehicle process with its vehicle registration and source dealer.
 */
export type ProcessAssignmentForAgent = ProcessAssignment & {
  service: {
    serviceId: string;
    serviceName: string;
    shortName: string;
  };
  agentStatus: {
    statusId: string;
    statusName: string;
    colour: string | null;
  } | null;
  process: {
    processId: string;
    vehicle: {
      registrationNumber: string;
    } | null;
    dealer: AssignmentDealerSummary | null;
  };
};

/**
 * Assignment shape carrying the chosen RTO service and the optional agent kanban status. Returned
 * by status updates and used as the `assignment` slice of the agent detail response.
 */
export type ProcessAssignmentWithServiceStatus = ProcessAssignment & {
  service: {
    serviceId: string;
    serviceName: string;
    shortName: string;
  };
  agentStatus: {
    statusId: string;
    statusName: string;
    colour: string | null;
  } | null;
};

/**
 * Assignment shape for the agent detail endpoint: the service + agent-status summaries plus the
 * source process's dealer summary (the full vehicle-process detail is resolved by the service).
 */
export type ProcessAssignmentDetailRow = ProcessAssignmentWithServiceStatus & {
  process: {
    dealer: AssignmentDealerSummary | null;
  };
};

/**
 * Data required to create a process assignment. `dealerId` is denormalized for dealer-scope;
 * `agentStatusId` defaults the kanban column; `note` and `assignedByUserId` are optional.
 */
export interface CreateProcessAssignmentData {
  processId: string;
  dealerId: string;
  agentId: string;
  serviceId: string;
  agentStatusId?: string | null;
  note?: string | null;
  assignedByUserId?: string | null;
}

/** Shared `select` for the chosen RTO service summary. */
const serviceSelect = {
  serviceId: true,
  serviceName: true,
  shortName: true,
} as const;

/** Shared `select` for the optional agent kanban status summary. */
const agentStatusSelect = {
  statusId: true,
  statusName: true,
  colour: true,
} as const;

/** Shared `include` for returning an assignment with its service + agent-status summaries. */
const serviceStatusInclude = {
  service: { select: serviceSelect },
  agentStatus: { select: agentStatusSelect },
} as const;

/** Shared `include` for the agent detail row (service, status, and the source dealer summary). */
const assignmentDetailInclude = {
  service: { select: serviceSelect },
  agentStatus: { select: agentStatusSelect },
  process: {
    select: {
      dealer: {
        select: {
          dealerId: true,
          firmName: true,
          dealerName: true,
          isPlaceholder: true,
        },
      },
    },
  },
} as const;

/** Shared `include` for the agent's dealer-wise list (service, status, process+vehicle+dealer). */
const agentAssignmentInclude = {
  service: { select: serviceSelect },
  agentStatus: { select: agentStatusSelect },
  process: {
    select: {
      processId: true,
      vehicle: { select: { registrationNumber: true } },
      dealer: {
        select: {
          dealerId: true,
          firmName: true,
          dealerName: true,
          isPlaceholder: true,
        },
      },
    },
  },
} as const;

/** Shared `include` for returning an assignment with its agent/service/status summaries. */
const assignmentInclude = {
  agent: {
    select: {
      agentId: true,
      firmName: true,
      agentName: true,
      displayName: true,
    },
  },
  service: {
    select: {
      serviceId: true,
      serviceName: true,
      shortName: true,
    },
  },
  agentStatus: {
    select: {
      statusId: true,
      statusName: true,
      colour: true,
    },
  },
} as const;

/**
 * Creates a process assignment and returns it with nested agent, service, and agent-status summaries.
 * A duplicate (same `processId` + `agentId` + `serviceId`) raises Prisma `P2002`.
 */
export async function createAssignment(
  data: CreateProcessAssignmentData,
): Promise<ProcessAssignmentWithRelations> {
  return prisma.processAssignment.create({
    data: {
      processId: data.processId,
      dealerId: data.dealerId,
      agentId: data.agentId,
      serviceId: data.serviceId,
      agentStatusId: data.agentStatusId ?? null,
      note: data.note ?? null,
      assignedByUserId: data.assignedByUserId ?? null,
    },
    include: assignmentInclude,
  });
}

/**
 * Lists non-cancelled assignments for a vehicle process (oldest first), each with nested
 * agent, service, and agent-status summaries.
 */
export async function listAssignmentsByProcess(
  processId: string,
): Promise<ProcessAssignmentWithRelations[]> {
  return prisma.processAssignment.findMany({
    where: { processId, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'asc' },
    include: assignmentInclude,
  });
}

/**
 * Finds a single process assignment by its ID (raw row, no relations).
 */
export async function findAssignmentById(
  assignmentId: string,
): Promise<ProcessAssignment | null> {
  return prisma.processAssignment.findUnique({
    where: { assignmentId },
  });
}

/**
 * Updates the status of a process assignment (e.g. to `CANCELLED`).
 */
export async function setAssignmentStatus(
  assignmentId: string,
  status: AssignmentStatus,
): Promise<ProcessAssignment> {
  return prisma.processAssignment.update({
    where: { assignmentId },
    data: { status },
  });
}

/**
 * Returns the live (`ACTIVE`) grant linking a dealer to an agent, or `null` when no such grant
 * exists. Read-only access to the `dealer_agent` table used to verify the dealer may assign work
 * to the agent.
 */
export async function findActiveGrant(
  dealerId: string,
  agentId: string,
): Promise<DealerAgent | null> {
  return prisma.dealerAgent.findFirst({
    where: { dealerId, agentId, status: 'ACTIVE' },
  });
}

/**
 * Returns the agent's lowest-ranked kanban status (used as the default column for new
 * assignments), or `null` when the agent has no statuses configured.
 */
export async function findFirstAgentStatus(
  agentId: string,
): Promise<AgentStatus | null> {
  return prisma.agentStatus.findFirst({
    where: { agentId },
    orderBy: { statusRank: 'asc' },
  });
}

/**
 * Lists non-cancelled assignments owned by an agent (newest first), each with nested service,
 * agent-status, and the source process (vehicle registration + source dealer summary).
 * Optionally narrows to a single source dealer.
 *
 * @param agentId - Resolved agent scope.
 * @param dealerId - Optional source-dealer UUID to filter by.
 */
export async function listAssignmentsForAgent(
  agentId: string,
  dealerId?: string,
): Promise<ProcessAssignmentForAgent[]> {
  return prisma.processAssignment.findMany({
    where: {
      agentId,
      status: { not: 'CANCELLED' },
      ...(dealerId ? { dealerId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: agentAssignmentInclude,
  });
}

/**
 * Finds a single process assignment by its ID with nested service + agent-status summaries and the
 * source process's dealer summary, or `null` when it does not exist. Powers the agent detail view.
 *
 * @param assignmentId - Assignment UUID.
 */
export async function findAssignmentByIdRaw(
  assignmentId: string,
): Promise<ProcessAssignmentDetailRow | null> {
  return prisma.processAssignment.findUnique({
    where: { assignmentId },
    include: assignmentDetailInclude,
  });
}

/**
 * Updates the agent kanban status (`agentStatusId`) of a process assignment and returns it with
 * nested service + agent-status summaries. Does not change the assignment `status`.
 *
 * @param assignmentId - Assignment UUID.
 * @param agentStatusId - Agent status UUID to move the assignment to.
 */
export async function updateAssignmentAgentStatus(
  assignmentId: string,
  agentStatusId: string,
): Promise<ProcessAssignmentWithServiceStatus> {
  return prisma.processAssignment.update({
    where: { assignmentId },
    data: { agentStatusId },
    include: serviceStatusInclude,
  });
}

/**
 * Returns the agent status row when it belongs to the given agent, or `null` otherwise. Used to
 * verify an agent may move an assignment into a status they actually own.
 *
 * @param agentId - Resolved agent scope.
 * @param statusId - Candidate agent status UUID.
 */
export async function findAgentStatusForAgent(
  agentId: string,
  statusId: string,
): Promise<AgentStatus | null> {
  return prisma.agentStatus.findFirst({
    where: { statusId, agentId },
  });
}
