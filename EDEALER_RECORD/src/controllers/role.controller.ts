import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createRole,
  listRoles,
  getRoleById,
  updateRole,
  deleteRole,
} from '../services/role.service';
import { sendSuccess } from '../utils/api-response';
import type {
  CreateRoleBody,
  UpdateRoleBody,
  RoleIdParams,
  ListRolesQuery,
} from '../validations/role.validation';

/**
 * POST /roles
 * Creates a role. `roleName` must be unique per `typeId`.
 */
export async function createRoleHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateRoleBody;
  const role = await createRole(body);
  sendSuccess(res, 'Role created', role, StatusCodes.CREATED);
}

/**
 * GET /roles
 * Lists roles for a tenant (`typeId` query required).
 */
export async function listRolesHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListRolesQuery;
  const { typeId, roleType, page, limit } = query;
  const result = await listRoles(typeId, roleType, { page, limit });
  sendSuccess(res, 'Roles retrieved', result);
}

/**
 * GET /roles/:id
 * Returns a single role.
 */
export async function getRoleByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RoleIdParams;
  const role = await getRoleById(id);
  sendSuccess(res, 'Role retrieved', role);
}

/**
 * PATCH /roles/:id
 * Updates a role (all body fields required).
 */
export async function updateRoleHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RoleIdParams;
  const body = req.body as UpdateRoleBody;
  const role = await updateRole(id, body);
  sendSuccess(res, 'Role updated', role);
}

/**
 * DELETE /roles/:id
 * Deletes a role.
 */
export async function deleteRoleHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RoleIdParams;
  await deleteRole(id);
  sendSuccess(res, 'Role deleted', {});
}
