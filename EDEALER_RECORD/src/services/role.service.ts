import { StatusCodes } from 'http-status-codes';
import type { Role, RoleType } from '@prisma/client';
import * as roleRepository from '../repositories/role.repository';
import { AppError } from '../utils/app-error';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../types';

/**
 * Input for creating a role. All fields required; `roleName` unique per `typeId`.
 */
export interface CreateRoleInput {
  roleName: string;
  roleType: RoleType;
  typeId: string;
}

/**
 * Input for updating a role. All fields required; `roleName` unique per `typeId` (excluding self).
 */
export interface UpdateRoleInput {
  roleName: string;
  roleType: RoleType;
  typeId: string;
}

/**
 * Creates a role. Throws if the same `roleName` exists for the same `typeId`.
 */
export async function createRole(input: CreateRoleInput): Promise<Role> {
  const existing = await roleRepository.findRoleByTypeIdAndRoleName(
    input.typeId,
    input.roleName,
  );
  if (existing) {
    throw new AppError(
      'Role name already exists for this tenant (typeId)',
      StatusCodes.CONFLICT,
      4091,
    );
  }
  return roleRepository.createRole(input);
}

/**
 * Lists roles for a tenant (`typeId`), optionally filtered by `roleType`.
 */
export async function listRoles(
  typeId: string,
  roleType: RoleType | undefined,
  query: PaginationQuery,
): Promise<PaginatedResult<Role>> {
  const { skip, take } = parsePagination(query);
  const { items, total } = await roleRepository.listRolesByTypeId(
    typeId,
    skip,
    take,
    roleType,
  );
  const meta = buildPaginationMeta(total, query);
  return { data: items, meta };
}

/**
 * Returns a single role by id or throws if not found.
 */
export async function getRoleById(roleId: string): Promise<Role> {
  const role = await roleRepository.findRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found', StatusCodes.NOT_FOUND, 4041);
  }
  return role;
}

/**
 * Updates a role. Throws on duplicate `(typeId, roleName)` for another role.
 */
export async function updateRole(roleId: string, input: UpdateRoleInput): Promise<Role> {
  await getRoleById(roleId);
  const duplicate = await roleRepository.findRoleByTypeIdAndRoleName(
    input.typeId,
    input.roleName,
  );
  if (duplicate && duplicate.roleId !== roleId) {
    throw new AppError(
      'Role name already exists for this tenant (typeId)',
      StatusCodes.CONFLICT,
      4091,
    );
  }
  return roleRepository.updateRole(roleId, input);
}

/**
 * Deletes a role by id.
 */
export async function deleteRole(roleId: string): Promise<void> {
  await getRoleById(roleId);
  await roleRepository.deleteRole(roleId);
}
