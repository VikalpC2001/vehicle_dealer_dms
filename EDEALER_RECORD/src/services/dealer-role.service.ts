import { StatusCodes } from 'http-status-codes';
import type { DealerRole } from '@prisma/client';
import * as dealerRoleRepository from '../repositories/dealer-role.repository';
import type { DealerRoleWithCount } from '../repositories/dealer-role.repository';
import {
  findDealerWiseUserAuthByUserId,
  updateDealerWiseUserRole,
} from '../repositories/dealer-wise-user.repository';
import type { DealerWiseUserWithUser } from '../repositories/dealer-wise-user.repository';
import { CAPABILITIES, findUnknownCapabilities } from '../config/dealer-capabilities';
import type { DealerCapability } from '../config/dealer-capabilities';
import { AppError } from '../utils/app-error';

/** Input to create a dealer role. */
export interface CreateDealerRoleInput {
  dealerId: string;
  roleName: string;
  capabilities: string[];
}

/** Input to update a dealer role. */
export interface UpdateDealerRoleInput {
  roleName?: string;
  capabilities?: string[];
}

/** Input to assign (or clear) a role on a dealer employee. */
export interface AssignDealerRoleInput {
  dealerId: string;
  userId: string;
  roleId: string | null;
}

/**
 * Returns the curated capability catalog (grouped keys/labels) for the FE checklist.
 */
export function getCapabilityCatalog(): readonly DealerCapability[] {
  return CAPABILITIES;
}

/**
 * Rejects any capability key not in the catalog (defense-in-depth alongside Zod).
 *
 * @throws AppError 4068 (422) listing the unknown keys.
 */
function assertValidCapabilities(capabilities: string[]): void {
  const unknown = findUnknownCapabilities(capabilities);
  if (unknown.length > 0) {
    throw new AppError(
      `Unknown capability key(s): ${unknown.join(', ')}`,
      StatusCodes.UNPROCESSABLE_ENTITY,
      4068,
    );
  }
}

/**
 * Lists a dealer's roles with member counts, newest first.
 */
export async function listDealerRoles(dealerId: string): Promise<DealerRoleWithCount[]> {
  return dealerRoleRepository.listDealerRolesByDealerId(dealerId);
}

/**
 * Creates a dealer role. Rejects unknown capability keys (4068). A duplicate `roleName` for the
 * dealer surfaces as a 409 (4090) via the Prisma unique constraint.
 */
export async function createDealerRole(input: CreateDealerRoleInput): Promise<DealerRole> {
  assertValidCapabilities(input.capabilities);
  return dealerRoleRepository.createDealerRole({
    dealerId: input.dealerId,
    roleName: input.roleName,
    capabilities: input.capabilities,
  });
}

/**
 * Loads a dealer role or throws 404 (used for scope checks on by-id ops).
 *
 * @throws AppError 4040 when the role does not exist.
 */
export async function getDealerRoleOrThrow(roleId: string): Promise<DealerRole> {
  const role = await dealerRoleRepository.findDealerRoleById(roleId);
  if (!role) {
    throw new AppError('Dealer role not found', StatusCodes.NOT_FOUND, 4040);
  }
  return role;
}

/**
 * Updates a dealer role's name and/or capabilities. Rejects unknown capability keys (4068).
 */
export async function updateDealerRole(
  roleId: string,
  input: UpdateDealerRoleInput,
): Promise<DealerRole> {
  if (input.capabilities !== undefined) {
    assertValidCapabilities(input.capabilities);
  }
  return dealerRoleRepository.updateDealerRole(roleId, input);
}

/**
 * Deletes a dealer role. Members are dropped to the read-only default (roleId → null).
 */
export async function deleteDealerRole(roleId: string): Promise<void> {
  await dealerRoleRepository.deleteDealerRole(roleId);
}

/**
 * Assigns a role to a dealer employee, or clears it (`roleId = null` → read-only default). Both the
 * target user and the role must belong to the caller's dealer.
 *
 * @throws AppError 4034 when the user is not a member of `dealerId`.
 * @throws AppError 4040 when `roleId` is not a role of `dealerId`.
 */
export async function assignRoleToUser(
  input: AssignDealerRoleInput,
): Promise<DealerWiseUserWithUser> {
  const auth = await findDealerWiseUserAuthByUserId(input.userId);
  if (!auth || auth.dealerId !== input.dealerId) {
    throw new AppError(
      'This user is not a member of your dealer',
      StatusCodes.FORBIDDEN,
      4034,
    );
  }
  // The dealership owner always has full access — a role assignment would be silently ignored, so
  // reject it (mirrors the UI, which shows the owner as non-assignable).
  if (auth.isOwner) {
    throw new AppError(
      'The dealership owner already has full access and cannot be assigned a role',
      StatusCodes.CONFLICT,
      4090,
    );
  }
  if (input.roleId) {
    const role = await dealerRoleRepository.findDealerRoleById(input.roleId);
    if (!role || role.dealerId !== input.dealerId) {
      throw new AppError('Dealer role not found', StatusCodes.NOT_FOUND, 4040);
    }
  }
  return updateDealerWiseUserRole(auth.dwuId, input.roleId);
}
