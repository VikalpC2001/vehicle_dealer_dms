import { StatusCodes } from 'http-status-codes';
import type { AgentStatus } from '@prisma/client';
import * as agentStatusRepository from '../repositories/agent-status.repository';
import { AppError } from '../utils/app-error';

/**
 * Input item for syncing agent statuses.
 */
export interface AgentStatusSyncItem {
  statusId?: string;
  statusName: string;
  colour?: string;
}

/**
 * Input for syncing all statuses for an agent.
 */
export interface SyncAgentStatusesInput {
  agentId: string;
  statusData: AgentStatusSyncItem[];
}

/**
 * Input for updating statusRank for multiple statuses for an agent.
 */
export interface UpdateAgentStatusOrderItem {
  statusId: string;
  statusRank: number;
}

export interface UpdateAgentStatusOrderInput {
  agentId: string;
  items: UpdateAgentStatusOrderItem[];
}

/**
 * Syncs all statuses for an agent based on the provided array.
 *
 * For the given agentId:
 * - Updates existing statuses whose statusId appears in the payload (statusName, colour, statusRank).
 * - Creates new statuses for items without statusId.
 * - Deletes any existing statuses for that agent that are not present in the payload.
 *
 * The order of the payload defines statusRank (1, 2, 3, ...).
 */
export async function syncAgentStatuses(
  input: SyncAgentStatusesInput,
): Promise<AgentStatus[]> {
  if (input.statusData.length === 0) {
    throw new AppError(
      'At least one status is required',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4221,
    );
  }

  // Basic uniqueness guard for statusName within the payload for this agent.
  const names = input.statusData.map((s) => s.statusName);
  if (new Set(names).size !== names.length) {
    throw new AppError(
      'Duplicate statusName in payload for this agent',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4222,
    );
  }

  return agentStatusRepository.syncAgentStatusesForAgent(
    input.agentId,
    input.statusData,
  );
}

/**
 * Returns all statuses for an agent ordered by statusRank ascending.
 */
export async function getAgentStatusesByAgentId(
  agentId: string,
): Promise<AgentStatus[]> {
  const { items } = await agentStatusRepository.listAgentStatuses(
    0,
    Number.MAX_SAFE_INTEGER,
    agentId,
  );
  return items;
}

/**
 * Updates statusRank for multiple statuses for an agent.
 * Ensures all statusIds belong to the given agent before updating.
 */
export async function updateAgentStatusOrder(
  input: UpdateAgentStatusOrderInput,
): Promise<AgentStatus[]> {
  if (input.items.length === 0) {
    throw new AppError(
      'At least one status is required',
      StatusCodes.UNPROCESSABLE_ENTITY,
      4221,
    );
  }

  const current = await agentStatusRepository.listAgentStatuses(
    0,
    Number.MAX_SAFE_INTEGER,
    input.agentId,
  );
  const currentIds = new Set(current.items.map((s) => s.statusId));

  for (const item of input.items) {
    if (!currentIds.has(item.statusId)) {
      throw new AppError(
        'One or more statuses do not belong to this agent',
        StatusCodes.UNPROCESSABLE_ENTITY,
        4223,
      );
    }
  }

  await agentStatusRepository.updateStatusRanks(input.items);
  return getAgentStatusesByAgentId(input.agentId);
}
