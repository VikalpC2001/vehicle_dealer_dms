import { prisma } from '../config/prisma';
import type { DealerRole } from '@prisma/client';

/** Fields required to create a dealer role. `roleName` is unique per dealer (DB-enforced). */
export interface CreateDealerRoleData {
  dealerId: string;
  roleName: string;
  capabilities: string[];
}

/** Mutable fields on a dealer role (dealer cannot change). */
export interface UpdateDealerRoleData {
  roleName?: string;
  capabilities?: string[];
}

/** A dealer role plus how many employees currently hold it. */
export interface DealerRoleWithCount extends DealerRole {
  memberCount: number;
}

/**
 * Creates a dealer role.
 *
 * @param data - Dealer id, role name, and capability keys.
 * @returns The created role.
 */
export async function createDealerRole(data: CreateDealerRoleData): Promise<DealerRole> {
  return prisma.dealerRole.create({
    data: {
      dealerId: data.dealerId,
      roleName: data.roleName,
      capabilities: data.capabilities,
    },
  });
}

/**
 * Lists a dealer's roles (newest first) with their member counts.
 *
 * @param dealerId - Dealer UUID.
 * @returns Roles with a `memberCount` each.
 */
export async function listDealerRolesByDealerId(
  dealerId: string,
): Promise<DealerRoleWithCount[]> {
  const rows = await prisma.dealerRole.findMany({
    where: { dealerId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { members: true } } },
  });
  return rows.map(({ _count, ...role }) => ({ ...role, memberCount: _count.members }));
}

/**
 * Finds a dealer role by id.
 *
 * @param roleId - Role UUID.
 * @returns The role or `null`.
 */
export async function findDealerRoleById(roleId: string): Promise<DealerRole | null> {
  return prisma.dealerRole.findUnique({ where: { roleId } });
}

/**
 * Updates a dealer role's name and/or capabilities.
 *
 * @param roleId - Role UUID.
 * @param data - Fields to update (only provided keys are written).
 * @returns The updated role.
 */
export async function updateDealerRole(
  roleId: string,
  data: UpdateDealerRoleData,
): Promise<DealerRole> {
  return prisma.dealerRole.update({
    where: { roleId },
    data: {
      ...(data.roleName !== undefined && { roleName: data.roleName }),
      ...(data.capabilities !== undefined && { capabilities: data.capabilities }),
    },
  });
}

/**
 * Deletes a dealer role. Members keep their link but their `roleId` is set null (DB `onDelete:
 * SetNull`), dropping them to the read-only default.
 *
 * @param roleId - Role UUID.
 */
export async function deleteDealerRole(roleId: string): Promise<void> {
  await prisma.dealerRole.delete({ where: { roleId }, select: { roleId: true } });
}
