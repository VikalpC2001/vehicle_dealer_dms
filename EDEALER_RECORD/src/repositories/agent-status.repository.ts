import { prisma } from '../config/prisma';
import type { AgentStatus } from '@prisma/client';

/**
 * Data required to create a new agent status. agentId and statusName are required; statusName is unique per agent; statusRank is assigned per agent.
 */
export interface CreateAgentStatusData {
  agentId: string;
  statusName: string;
  colour?: string;
}

/**
 * Data allowed when updating an agent status. statusName must be unique within the same agent (excluding current status).
 */
export interface UpdateAgentStatusData {
  statusName: string;
  colour?: string;
}

/**
 * Creates a new agent status for the given agent. Assigns the next sequential statusRank for that agent.
 */
export async function createAgentStatus(
  data: CreateAgentStatusData,
): Promise<AgentStatus> {
  return prisma.$transaction(async (tx) => {
    const lastStatus = await tx.agentStatus.findFirst({
      where: { agentId: data.agentId },
      orderBy: { statusRank: 'desc' },
      select: { statusRank: true },
    });
    const nextRank = (lastStatus?.statusRank ?? 0) + 1;
    return tx.agentStatus.create({
      data: {
        agentId: data.agentId,
        statusName: data.statusName,
        colour: data.colour ?? null,
        statusRank: nextRank,
      },
    });
  });
}

/**
 * Returns a paginated list of agent statuses. When agentId is provided, filters by agent and orders by statusRank ascending.
 */
export async function listAgentStatuses(
  skip: number,
  take: number,
  agentId?: string,
): Promise<{ items: AgentStatus[]; total: number }> {
  const where = agentId ? { agentId } : {};
  const [items, total] = await Promise.all([
    prisma.agentStatus.findMany({
      where,
      skip,
      take,
      orderBy: [{ agentId: 'asc' }, { statusRank: 'asc' }],
    }),
    prisma.agentStatus.count({ where }),
  ]);
  return { items, total };
}

/**
 * Synchronises all statuses for an agent in a single transaction.
 *
 * For the given agentId:
 * - Updates existing statuses whose statusId appears in the payload (statusName, colour, statusRank).
 * - Creates new statuses for items without statusId.
 * - Deletes any existing statuses for that agent that are not present in the payload.
 *
 * The order of the payload defines statusRank (1, 2, 3, ...).
 */
export async function syncAgentStatusesForAgent(
  agentId: string,
  items: Array<{ statusId?: string; statusName: string; colour?: string }>,
): Promise<AgentStatus[]> {
  return prisma.$transaction(async (tx) => {
    // Fetch current statuses for this agent
    const existing = await tx.agentStatus.findMany({
      where: { agentId },
      orderBy: { statusRank: 'asc' },
    });

    const existingById = new Map(existing.map((s) => [s.statusId, s]));
    const incomingIds = new Set<string>();
    const results: AgentStatus[] = [];

    // Upsert and order
    for (let index = 0; index < items.length; index += 1) {
      const { statusId, statusName, colour } = items[index];
      const statusRank = index + 1;

      if (statusId && existingById.has(statusId)) {
        incomingIds.add(statusId);
        const updated = await tx.agentStatus.update({
          where: { statusId },
          data: { statusName, colour: colour ?? null, statusRank },
        });
        results.push(updated);
      } else {
        const created = await tx.agentStatus.create({
          data: {
            agentId,
            statusName,
            colour: colour ?? null,
            statusRank,
          },
        });
        incomingIds.add(created.statusId);
        results.push(created);
      }
    }

    // Delete statuses that are not in the incoming list
    const toDelete = existing.filter((s) => !incomingIds.has(s.statusId));
    if (toDelete.length > 0) {
      await tx.agentStatus.deleteMany({
        where: {
          agentId,
          statusId: { in: toDelete.map((s) => s.statusId) },
        },
      });
    }

    // Return the final ordered list
    return results.sort((a, b) => a.statusRank - b.statusRank);
  });
}

/**
 * Finds a single agent status by ID.
 */
export async function findAgentStatusById(
  statusId: string,
): Promise<AgentStatus | null> {
  return prisma.agentStatus.findUnique({
    where: { statusId },
  });
}

/**
 * Finds an agent status by agentId and statusName. Optionally exclude a status ID (for update uniqueness check).
 */
export async function findAgentStatusByAgentIdAndStatusName(
  agentId: string,
  statusName: string,
  excludeStatusId?: string,
): Promise<AgentStatus | null> {
  return prisma.agentStatus.findFirst({
    where: {
      agentId,
      statusName,
      ...(excludeStatusId && { statusId: { not: excludeStatusId } }),
    },
  });
}

/**
 * Updates an existing agent status (statusName and colour only; agentId cannot be changed).
 */
export async function updateAgentStatus(
  statusId: string,
  data: UpdateAgentStatusData,
): Promise<AgentStatus> {
  return prisma.agentStatus.update({
    where: { statusId },
    data: {
      statusName: data.statusName,
      ...(data.colour !== undefined && { colour: data.colour }),
    },
  });
}

/**
 * Deletes an agent status by ID.
 */
export async function deleteAgentStatus(
  statusId: string,
): Promise<AgentStatus> {
  return prisma.agentStatus.delete({
    where: { statusId },
  });
}

/**
 * Item for bulk statusRank update. Only statusRank is updated.
 */
export interface UpdateStatusRankItem {
  statusId: string;
  statusRank: number;
}

/**
 * Updates statusRank for multiple agent statuses in one transaction. Returns updated records in request order.
 */
export async function updateStatusRanks(
  items: UpdateStatusRankItem[],
): Promise<AgentStatus[]> {
  return prisma.$transaction(async (tx) => {
    const results: AgentStatus[] = [];
    for (const { statusId, statusRank } of items) {
      const updated = await tx.agentStatus.update({
        where: { statusId },
        data: { statusRank },
      });
      results.push(updated);
    }
    return results;
  });
}
