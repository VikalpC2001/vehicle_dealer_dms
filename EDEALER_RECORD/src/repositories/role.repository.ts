import { prisma } from '../config/prisma';
import type { Role, RoleType } from '@prisma/client';

/**
 * Payload for creating a role. `roleName` must be unique per `typeId` (DB + app checks).
 */
export interface CreateRoleData {
  roleName: string;
  roleType: RoleType;
  typeId: string;
}

/**
 * Payload for updating a role. All fields required.
 */
export interface UpdateRoleData {
  roleName: string;
  roleType: RoleType;
  typeId: string;
}

/**
 * Creates a role row.
 *
 * @param data - Role fields.
 * @returns Created `Role`.
 */
export async function createRole(data: CreateRoleData): Promise<Role> {
  return prisma.role.create({
    data: {
      roleName: data.roleName,
      roleType: data.roleType,
      typeId: data.typeId,
    },
  });
}

/**
 * Finds a role by primary key.
 *
 * @param roleId - Role UUID.
 * @returns `Role` or `null`.
 */
export async function findRoleById(roleId: string): Promise<Role | null> {
  return prisma.role.findUnique({
    where: { roleId },
  });
}

/**
 * Finds a role by tenant + name (for uniqueness checks).
 *
 * @param typeId - Dealer or agent id.
 * @param roleName - Role display name.
 * @returns `Role` or `null`.
 */
export async function findRoleByTypeIdAndRoleName(
  typeId: string,
  roleName: string,
): Promise<Role | null> {
  return prisma.role.findUnique({
    where: {
      typeId_roleName: {
        typeId,
        roleName,
      },
    },
  });
}

/**
 * Lists roles for a tenant with optional `roleType` filter and pagination.
 *
 * @param typeId - Dealer or agent id.
 * @param skip - Offset.
 * @param take - Page size.
 * @param roleType - Optional filter.
 * @returns Items and total count.
 */
export async function listRolesByTypeId(
  typeId: string,
  skip: number,
  take: number,
  roleType?: RoleType,
): Promise<{ items: Role[]; total: number }> {
  const where = {
    typeId,
    ...(roleType !== undefined ? { roleType } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.role.findMany({
      where,
      skip,
      take,
      orderBy: { roleName: 'asc' },
    }),
    prisma.role.count({ where }),
  ]);
  return { items, total };
}

/**
 * Updates a role by id.
 *
 * @param roleId - Role UUID.
 * @param data - Full role fields.
 * @returns Updated `Role`.
 */
export async function updateRole(roleId: string, data: UpdateRoleData): Promise<Role> {
  return prisma.role.update({
    where: { roleId },
    data: {
      roleName: data.roleName,
      roleType: data.roleType,
      typeId: data.typeId,
    },
  });
}

/**
 * Deletes a role by id.
 *
 * @param roleId - Role UUID.
 */
export async function deleteRole(roleId: string): Promise<void> {
  await prisma.role.delete({
    where: { roleId },
  });
}
