import { prisma } from '../config/prisma';
import { RoleType } from '@prisma/client';
import type {
  AgentStatus,
  AssignmentStatus,
  DealerAgent,
  LedgerEntry,
  Prisma,
  ProcessAssignment,
  VehicleProcessStatus,
} from '@prisma/client';
import {
  postEntryOnTx,
  reverseEntryOnTx,
  updateEntryMetaOnTx,
  findActiveAssignmentCostEntryOnTx,
} from './khata.repository';

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
    processTags: {
      tag: { tagId: string; tagName: string; colour: string | null };
    }[];
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
 * Assignment shape for a DEALER's view of the work given to one agent: the chosen RTO service, the
 * agent's own kanban status, and the source vehicle process with its vehicle, lifecycle status, the
 * agent-entered RC-book tracking number / RTO receipt key, and tags.
 */
export type ProcessAssignmentForDealerAgent = ProcessAssignment & {
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
    status: VehicleProcessStatus | null;
    dealNumber: string | null;
    processDate: Date | null;
    trackingNumber: string | null;
    receiptImageName: string | null;
    vehicle: {
      registrationNumber: string;
      make: string | null;
      model: string | null;
      manufactureYear: number | null;
    } | null;
    processTags: {
      tag: { tagId: string; tagName: string; colour: string | null };
    }[];
  };
};

/** `agentStatusId` filter value selecting assignments the agent has not put in any status yet. */
export const NO_AGENT_STATUS_FILTER = 'none';

/** How many distinct words of a search the "every word matches some field" rule looks at. */
const MAX_SEARCH_WORDS = 6;

/**
 * Filter for a dealer's list of the work given to one agent. `dealerId` + `agentId` are the
 * tenant scope and always apply; `search` matches the vehicle registration number, make or model
 * and the service name; `agentStatusId` narrows to one of the agent's kanban statuses, or to
 * assignments with no status when it is {@link NO_AGENT_STATUS_FILTER}.
 */
export interface DealerAgentAssignmentFilter {
  dealerId: string;
  agentId: string;
  search?: string | null;
  agentStatusId?: string | null;
}

/** The ids a dealer-agent summary is computed from: one row per live assignment of the pair. */
export interface DealerAgentAssignmentKey {
  assignmentId: string;
  processId: string;
  agentStatusId: string | null;
}

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
      processTags: { select: { tag: { select: { tagId: true, tagName: true, colour: true } } } },
    },
  },
} as const;

/** Shared `include` for a dealer's list of the work given to one agent (service, status, process). */
const dealerAgentAssignmentInclude = {
  service: { select: serviceSelect },
  agentStatus: { select: agentStatusSelect },
  process: {
    select: {
      processId: true,
      status: true,
      dealNumber: true,
      processDate: true,
      trackingNumber: true,
      receiptImageName: true,
      vehicle: {
        select: { registrationNumber: true, make: true, model: true, manufactureYear: true },
      },
      processTags: {
        select: { tag: { select: { tagId: true, tagName: true, colour: true } } },
        orderBy: { tag: { tagName: 'asc' } },
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

/** The optional agent cost recorded to the ledger alongside an assignment. */
export interface AssignmentCostInput {
  amount: number;
  entryDate?: Date | null;
  description?: string | null;
}

/**
 * Creates a process assignment and, when a cost is given, posts the matching `CREDIT` ledger entry
 * (dealer owes agent) linked to the new assignment — atomically, in ONE transaction. All scope /
 * grant guards must be enforced by the service before calling this.
 *
 * @returns the created assignment plus the cost `LedgerEntry` (or `null` when no cost was given).
 */
async function upsertAssignmentWithCostOnTx(
  tx: Prisma.TransactionClient,
  params: {
    assignment: CreateProcessAssignmentData;
    cost?: AssignmentCostInput | null;
    postedByUserId?: string | null;
  },
): Promise<{ assignment: ProcessAssignmentWithRelations; costEntry: LedgerEntry | null }> {
  const a = params.assignment;
  // Upsert on the (process, agent, service) unique: create a fresh assignment, or REACTIVATE a
  // previously CANCELLED one for the same triple (so cancel → re-assign works instead of hitting
  // the unique constraint). The service rejects a still-live duplicate before we get here, so the
  // update branch only ever reactivates a cancelled row.
  const assignment = await tx.processAssignment.upsert({
    where: {
      processId_agentId_serviceId: {
        processId: a.processId,
        agentId: a.agentId,
        serviceId: a.serviceId,
      },
    },
    create: {
      processId: a.processId,
      dealerId: a.dealerId,
      agentId: a.agentId,
      serviceId: a.serviceId,
      agentStatusId: a.agentStatusId ?? null,
      note: a.note ?? null,
      assignedByUserId: a.assignedByUserId ?? null,
    },
    update: {
      status: 'OPEN',
      agentStatusId: a.agentStatusId ?? null,
      note: a.note ?? null,
      assignedByUserId: a.assignedByUserId ?? null,
      // A re-assignment is a new assignment: it is dated, and listed, as the day it was given again.
      createdAt: new Date(),
    },
    include: assignmentInclude,
  });

  // Reactivation clean-slate: reverse any still-live cost left over from a prior life of this
  // triple so a reactivated assignment never carries a stale cost (a fresh create has none).
  const priorCost = await findActiveAssignmentCostEntryOnTx(tx, assignment.assignmentId, {
    dealerId: a.dealerId,
    agentId: a.agentId,
  });
  if (priorCost) {
    await reverseEntryOnTx(tx, priorCost.ledgerEntryId, params.postedByUserId ?? null, RoleType.DEALER);
  }

  let costEntry: LedgerEntry | null = null;
  if (params.cost && params.cost.amount > 0) {
    const { entry } = await postEntryOnTx(tx, {
      dealerId: a.dealerId,
      agentId: a.agentId,
      direction: 'CREDIT',
      amount: params.cost.amount,
      description: params.cost.description ?? null,
      entryDate: params.cost.entryDate ?? null,
      postedByUserId: params.postedByUserId ?? null,
      postedByRole: RoleType.DEALER,
      assignmentId: assignment.assignmentId,
      sourceDealerId: null,
    });
    costEntry = entry;
  }
  return { assignment, costEntry };
}

export async function createAssignmentWithCost(params: {
  assignment: CreateProcessAssignmentData;
  cost?: AssignmentCostInput | null;
  postedByUserId?: string | null;
}): Promise<{ assignment: ProcessAssignmentWithRelations; costEntry: LedgerEntry | null }> {
  return prisma.$transaction((tx) => upsertAssignmentWithCostOnTx(tx, params));
}

/**
 * Creates MANY assignments (one per service) for a (process, agent) in ONE transaction. The optional
 * `cost` is posted per service (a CREDIT linked to each new assignment). Scope/grant/service-exists
 * guards and skipping already-active services are the service layer's job. Returns the created rows.
 */
export async function createManyAssignmentsWithCost(params: {
  assignments: CreateProcessAssignmentData[];
  cost?: AssignmentCostInput | null;
  postedByUserId?: string | null;
}): Promise<ProcessAssignmentWithRelations[]> {
  return prisma.$transaction(async (tx) => {
    const created: ProcessAssignmentWithRelations[] = [];
    for (const assignment of params.assignments) {
      const { assignment: row } = await upsertAssignmentWithCostOnTx(tx, {
        assignment,
        cost: params.cost,
        postedByUserId: params.postedByUserId,
      });
      created.push(row);
    }
    return created;
  });
}

/**
 * Sets/changes/removes the agent cost for an existing assignment, atomically, respecting the
 * append-only ledger:
 * - `amount === null` → reverse the current cost entry (remove).
 * - `amount === undefined` (keep) → update the current entry's date/description in place.
 * - amount changed → reverse the current entry + post a new one (the correct way to "edit" an
 *   amount without corrupting later rows' `balanceAfter`).
 * - amount unchanged → update date/description in place.
 * - no current entry + a positive amount → post a fresh cost entry.
 *
 * When only the amount changes, the original entry's date/description carry over unless overridden.
 *
 * @returns the resulting live cost `LedgerEntry`, or `null` when the cost was removed / none exists.
 */
export async function updateAssignmentCost(params: {
  dealerId: string;
  agentId: string;
  assignmentId: string;
  amount?: number | null;
  entryDate?: Date | null;
  description?: string | null;
  postedByUserId?: string | null;
}): Promise<{ costEntry: LedgerEntry | null }> {
  return prisma.$transaction(async (tx) => {
    const current = await findActiveAssignmentCostEntryOnTx(tx, params.assignmentId, {
      dealerId: params.dealerId,
      agentId: params.agentId,
    });

    const metaOnly = {
      entryDate: params.entryDate ?? undefined,
      description: params.description !== undefined ? params.description : undefined,
    };
    // Whether the request actually carries a date/description change (else an in-place update
    // would be a no-op — and a Prisma update with empty `data` is invalid).
    const hasMetaChange = params.entryDate != null || params.description !== undefined;

    // Remove the cost.
    if (params.amount === null) {
      if (current) {
        await reverseEntryOnTx(tx, current.ledgerEntryId, params.postedByUserId ?? null, RoleType.DEALER);
      }
      return { costEntry: null };
    }

    // Keep the amount — only date/description change (safe in place).
    if (params.amount === undefined) {
      if (!current) return { costEntry: null };
      if (!hasMetaChange) return { costEntry: current };
      const updated = await updateEntryMetaOnTx(tx, current.ledgerEntryId, metaOnly);
      return { costEntry: updated };
    }

    // Set the amount. If unchanged, edit metadata in place (or no-op); else reverse + repost.
    const currentAmount = current ? current.amount.toNumber() : null;
    if (current && currentAmount === params.amount) {
      if (!hasMetaChange) return { costEntry: current };
      const updated = await updateEntryMetaOnTx(tx, current.ledgerEntryId, metaOnly);
      return { costEntry: updated };
    }
    if (current) {
      await reverseEntryOnTx(tx, current.ledgerEntryId, params.postedByUserId ?? null, RoleType.DEALER);
    }
    const { entry } = await postEntryOnTx(tx, {
      dealerId: params.dealerId,
      agentId: params.agentId,
      direction: 'CREDIT',
      amount: params.amount,
      description:
        params.description !== undefined ? params.description : (current?.description ?? null),
      entryDate: params.entryDate ?? current?.entryDate ?? null,
      postedByUserId: params.postedByUserId ?? null,
      postedByRole: RoleType.DEALER,
      assignmentId: params.assignmentId,
      sourceDealerId: null,
    });
    return { costEntry: entry };
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
 * Finds the assignment for a (process, agent, service) triple, whatever its status (including
 * CANCELLED), via the `@@unique([processId, agentId, serviceId])` key. Used to distinguish a
 * still-live duplicate (reject) from a cancelled one (reactivate) before assigning.
 */
export async function findAssignmentByTriple(
  processId: string,
  agentId: string,
  serviceId: string,
): Promise<ProcessAssignment | null> {
  return prisma.processAssignment.findUnique({
    where: { processId_agentId_serviceId: { processId, agentId, serviceId } },
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

/** Open assignment for a (dealer, agent) pair, with the service + source vehicle for preview. */
export type OpenAssignmentForPair = ProcessAssignment & {
  service: { serviceId: string; serviceName: string; shortName: string };
  process: { processId: string; vehicle: { registrationNumber: string } | null };
};

/**
 * Lists the OPEN assignments a dealer has given to an agent (the "active work" surfaced before an
 * agent switch), each with its chosen RTO service and source vehicle registration. Newest first.
 *
 * @param dealerId - Resolved dealer scope.
 * @param agentId - The agent whose open work is being previewed.
 */
export async function listOpenAssignmentsForPair(
  dealerId: string,
  agentId: string,
): Promise<OpenAssignmentForPair[]> {
  return prisma.processAssignment.findMany({
    // Skip open work whose source process is in the recycle bin (soft-deleted).
    where: { dealerId, agentId, status: 'OPEN', process: { is: { deletedAt: null } } },
    orderBy: { createdAt: 'desc' },
    include: {
      service: { select: serviceSelect },
      process: {
        select: { processId: true, vehicle: { select: { registrationNumber: true } } },
      },
    },
  });
}

/**
 * Marks all OPEN assignments for a (dealer, agent) pair as COMPLETED, on the supplied transaction
 * client so it composes into the atomic agent-switch flow. Idempotent — the `status: 'OPEN'` filter
 * means a re-run completes nothing. Returns the number of assignments completed.
 *
 * @param tx - The active transaction client.
 * @param dealerId - Resolved dealer scope.
 * @param agentId - The agent whose open work is being closed out.
 */
export async function completeOpenAssignmentsForPair(
  tx: Prisma.TransactionClient,
  dealerId: string,
  agentId: string,
): Promise<number> {
  const result = await tx.processAssignment.updateMany({
    where: { dealerId, agentId, status: 'OPEN' },
    data: { status: 'COMPLETED' },
  });
  return result.count;
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
      // Hide assignments whose source process was soft-deleted (moved to the dealer's recycle bin).
      process: { is: { deletedAt: null } },
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

/**
 * Finds a non-cancelled assignment linking a process to an agent (any service), or `null`. Used to
 * authorize a dealer-assigned agent's access to a process's comment thread — including the edge case
 * of an agent whose managing grant was later revoked but whose assignment row survives.
 *
 * @param processId - Vehicle process UUID.
 * @param agentId - Candidate agent UUID.
 */
export async function findAssignmentForProcessAgent(
  processId: string,
  agentId: string,
): Promise<ProcessAssignment | null> {
  return prisma.processAssignment.findFirst({
    where: { processId, agentId, status: { not: 'CANCELLED' } },
  });
}

/**
 * The live work a dealer has given an agent: the pair's assignments that are not CANCELLED and
 * whose source process is not in the recycle bin. Every dealer-agent list/summary query starts here,
 * so the list, its page count and the totals always describe the same rows.
 */
const dealerAgentAssignmentScope = (
  dealerId: string,
  agentId: string,
): Prisma.ProcessAssignmentWhereInput => ({
  dealerId,
  agentId,
  status: { not: 'CANCELLED' },
  process: { is: { deletedAt: null } },
});

/**
 * The fields one search text is matched against: the service name / short name and the vehicle make
 * and model (raw text, with LIKE wildcards escaped so `%` and `_` are searched literally), and the
 * registration number (stored normalized, so matched against the text stripped of spaces and
 * punctuation). All case-insensitive.
 */
function assignmentSearchFilters(text: string): Prisma.ProcessAssignmentWhereInput[] {
  const like = text.replace(/[\\%_]/g, '\\$&');
  const vehicleFields: Prisma.VehicleWhereInput[] = [
    { make: { contains: like, mode: 'insensitive' } },
    { model: { contains: like, mode: 'insensitive' } },
  ];
  const registration = text.replace(/[^a-zA-Z0-9]/g, '');
  if (registration) {
    vehicleFields.push({ registrationNumber: { contains: registration, mode: 'insensitive' } });
  }
  // One filter per relation (the fields OR-ed inside it) keeps the statement small.
  return [
    {
      service: {
        is: {
          OR: [
            { serviceName: { contains: like, mode: 'insensitive' } },
            { shortName: { contains: like, mode: 'insensitive' } },
          ],
        },
      },
    },
    { process: { is: { vehicle: { is: { OR: vehicleFields } } } } },
  ];
}

/** Builds the `where` for a dealer-agent assignment list: the pair scope plus the optional filters. */
function buildDealerAgentAssignmentWhere(
  filter: DealerAgentAssignmentFilter,
): Prisma.ProcessAssignmentWhereInput {
  const where = dealerAgentAssignmentScope(filter.dealerId, filter.agentId);

  if (filter.agentStatusId === NO_AGENT_STATUS_FILTER) {
    where.agentStatusId = null;
  } else if (filter.agentStatusId) {
    where.agentStatusId = filter.agentStatusId;
  }

  const term = filter.search?.trim();
  if (term) {
    // The whole term may match one field ("name transfer"), or — when it has several words — every
    // word may match some field ("maruti swift" = make + model, exactly as the row prints them).
    const or = assignmentSearchFilters(term);
    // Distinct words only, and at most MAX_SEARCH_WORDS of them: every word adds joins, and a
    // search of dozens of one-letter words would otherwise build a statement that hurts the database.
    const words = [...new Set(term.toLowerCase().split(/\s+/).filter(Boolean))].slice(
      0,
      MAX_SEARCH_WORDS,
    );
    if (words.length > 1) {
      or.push({ AND: words.map((word) => ({ OR: assignmentSearchFilters(word) })) });
    }
    // AND-ed with the scope (the scope's own `process` filter stays in force).
    where.AND = [{ OR: or }];
  }
  return where;
}

/**
 * Lists one page of the live work a dealer has given an agent (newest first), each row with its RTO
 * service, the agent's kanban status, and the source process (vehicle, lifecycle status, tracking
 * number, receipt key, tags). Also returns the total number of rows matching the filter.
 *
 * @param filter - Tenant scope (`dealerId`, `agentId`) plus optional `search` / `agentStatusId`.
 * @param page - Prisma `skip` / `take` for the requested page.
 */
export async function listAssignmentsForDealerAgent(
  filter: DealerAgentAssignmentFilter,
  page: { skip: number; take: number },
): Promise<{ items: ProcessAssignmentForDealerAgent[]; total: number }> {
  const where = buildDealerAgentAssignmentWhere(filter);
  const [items, total] = await Promise.all([
    prisma.processAssignment.findMany({
      where,
      // `assignmentId` breaks ties so pages never overlap (a multi-service assign shares a timestamp).
      orderBy: [{ createdAt: 'desc' }, { assignmentId: 'asc' }],
      skip: page.skip,
      take: page.take,
      include: dealerAgentAssignmentInclude,
    }),
    prisma.processAssignment.count({ where }),
  ]);
  return { items, total };
}

/**
 * Returns the ids of ALL live assignments a dealer has given an agent (unfiltered, unpaginated):
 * the assignment, its process and its agent status. The service derives the totals from these.
 *
 * @param dealerId - Resolved dealer scope.
 * @param agentId - The agent whose assigned work is being summarised.
 */
export async function listAssignmentKeysForDealerAgent(
  dealerId: string,
  agentId: string,
): Promise<DealerAgentAssignmentKey[]> {
  return prisma.processAssignment.findMany({
    where: dealerAgentAssignmentScope(dealerId, agentId),
    select: { assignmentId: true, processId: true, agentStatusId: true },
  });
}
