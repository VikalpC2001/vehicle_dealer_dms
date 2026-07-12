import { StatusCodes } from 'http-status-codes';
import type { Dealer } from '@prisma/client';
import * as placeholderDealerRepository from '../repositories/placeholder-dealer.repository';
import type { PlaceholderDealerWithConnection } from '../repositories/placeholder-dealer.repository';
import { AppError } from '../utils/app-error';
import type {
  CreatePlaceholderBody,
  UpdatePlaceholderBody,
} from '../validations/placeholder-dealer.validation';

/**
 * Loads a placeholder dealer and asserts it is a placeholder owned by the calling agent.
 *
 * @param agentId - The calling agent's id.
 * @param dealerId - The placeholder dealer id.
 * @returns The owned placeholder dealer (with connection summary).
 * @throws AppError 404 (4040) when not found; 403 (4037) when not an owned placeholder.
 */
async function loadOwnedPlaceholder(
  agentId: string,
  dealerId: string,
): Promise<PlaceholderDealerWithConnection> {
  const row = await placeholderDealerRepository.findPlaceholderById(dealerId);
  if (!row) {
    throw new AppError('Placeholder dealer not found', StatusCodes.NOT_FOUND, 4040);
  }
  if (!row.isPlaceholder || row.ownerAgentId !== agentId) {
    throw new AppError(
      'You do not have access to this placeholder dealer',
      StatusCodes.FORBIDDEN,
      4037,
    );
  }
  return row;
}

/**
 * Creates a placeholder dealer for the calling agent. `dealerName` and `displayName`
 * default to `firmName` when omitted.
 *
 * @param agentId - The owning agent's id.
 * @param body - The placeholder name fields.
 * @returns The newly created placeholder dealer.
 */
export async function createPlaceholder(
  agentId: string,
  body: CreatePlaceholderBody,
): Promise<Dealer> {
  return placeholderDealerRepository.createPlaceholderDealer({
    ownerAgentId: agentId,
    firmName: body.firmName,
    dealerName: body.dealerName ?? body.firmName,
    displayName: body.displayName ?? body.firmName,
  });
}

/**
 * Lists all placeholder dealers owned by the calling agent, newest first.
 *
 * @param agentId - The owning agent's id.
 * @returns Placeholder dealers with their connected-dealer summary.
 */
export async function listPlaceholders(
  agentId: string,
): Promise<PlaceholderDealerWithConnection[]> {
  return placeholderDealerRepository.listPlaceholderDealersForAgent(agentId);
}

/**
 * Updates the name fields of a placeholder dealer owned by the calling agent.
 *
 * @param agentId - The owning agent's id.
 * @param id - The placeholder dealer id.
 * @param body - The name fields to change.
 * @returns The updated placeholder dealer (with connection).
 */
export async function updatePlaceholder(
  agentId: string,
  id: string,
  body: UpdatePlaceholderBody,
): Promise<PlaceholderDealerWithConnection> {
  await loadOwnedPlaceholder(agentId, id);
  return placeholderDealerRepository.updatePlaceholderDealer(id, body);
}

/**
 * Deletes a placeholder dealer owned by the calling agent. Refuses deletion when
 * the placeholder has any vehicle processes attached.
 *
 * @param agentId - The owning agent's id.
 * @param id - The placeholder dealer id.
 * @returns The deleted dealer row.
 * @throws AppError 409 (4093) when the placeholder has processes.
 */
export async function deletePlaceholder(agentId: string, id: string): Promise<Dealer> {
  await loadOwnedPlaceholder(agentId, id);
  const processCount = await placeholderDealerRepository.countProcessesForDealer(id);
  if (processCount > 0) {
    throw new AppError(
      'Cannot delete a placeholder with processes',
      StatusCodes.CONFLICT,
      4093,
    );
  }
  return placeholderDealerRepository.deletePlaceholderDealer(id);
}

/**
 * Connects a placeholder dealer owned by the calling agent to a real subscribed dealer.
 * Sets `connectedDealerId` on the placeholder and creates/reactivates a CONNECT grant
 * so the agent gains access to the real dealer.
 *
 * @param agentId - The owning agent's id.
 * @param id - The placeholder dealer id.
 * @param realDealerId - The target real dealer id.
 * @returns The updated placeholder dealer (with connection).
 * @throws AppError 404 (4040) when placeholder or target is missing;
 *   409 (4098) when the target is not a subscribed real dealer.
 */
export async function connectPlaceholder(
  agentId: string,
  id: string,
  realDealerId: string,
): Promise<PlaceholderDealerWithConnection> {
  await loadOwnedPlaceholder(agentId, id);

  const realDealer = await placeholderDealerRepository.findRealDealerById(realDealerId);
  if (!realDealer) {
    throw new AppError('Target dealer not found', StatusCodes.NOT_FOUND, 4040);
  }
  if (realDealer.isPlaceholder || !realDealer.isSubscribe) {
    throw new AppError(
      'Cannot connect: target is not a subscribed real dealer',
      StatusCodes.CONFLICT,
      4098,
    );
  }

  await placeholderDealerRepository.upsertConnectGrant(realDealerId, agentId);
  return placeholderDealerRepository.setPlaceholderConnection(id, realDealerId);
}

/**
 * Disconnects a placeholder dealer owned by the calling agent from its real dealer.
 * Clears `connectedDealerId` and revokes the CONNECT grant when one was present.
 *
 * @param agentId - The owning agent's id.
 * @param id - The placeholder dealer id.
 * @returns The updated placeholder dealer (with connection cleared).
 */
export async function disconnectPlaceholder(
  agentId: string,
  id: string,
): Promise<PlaceholderDealerWithConnection> {
  const placeholder = await loadOwnedPlaceholder(agentId, id);
  const previousConnectedDealerId = placeholder.connectedDealerId;

  const updated = await placeholderDealerRepository.setPlaceholderConnection(id, null);

  if (previousConnectedDealerId) {
    await placeholderDealerRepository.revokeConnectGrant(previousConnectedDealerId, agentId);
  }
  return updated;
}
