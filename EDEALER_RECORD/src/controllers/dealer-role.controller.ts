import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  getCapabilityCatalog,
  listDealerRoles,
  createDealerRole,
  getDealerRoleOrThrow,
  updateDealerRole,
  deleteDealerRole,
  assignRoleToUser,
} from '../services/dealer-role.service';
import { sendSuccess } from '../utils/api-response';
import { resolveManagedDealerId, assertManagedDealerMatches } from '../utils/managed-dealer-scope';
import { resolveDealerCapabilities } from '../utils/dealer-capabilities';
import type {
  CreateDealerRoleBody,
  UpdateDealerRoleBody,
  DealerRoleIdParams,
  AssignDealerRoleBody,
} from '../validations/dealer-role.validation';

/**
 * GET /dealer-roles/capabilities
 * Returns the curated capability catalog for the FE checklist.
 */
export function getCapabilityCatalogHandler(_req: Request, res: Response): void {
  sendSuccess(res, 'Capability catalog retrieved', { capabilities: getCapabilityCatalog() });
}

/**
 * GET /dealer-roles/me
 * Returns the caller's effective capabilities (resolved fresh from the DB).
 */
export async function getMyCapabilitiesHandler(req: Request, res: Response): Promise<void> {
  const resolved = await resolveDealerCapabilities(req);
  sendSuccess(res, 'Effective capabilities retrieved', resolved);
}

/**
 * GET /dealer-roles
 * Lists the caller's dealer roles with member counts.
 */
export async function listDealerRolesHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as { dealerId?: string };
  const dealerId = await resolveManagedDealerId(req, q.dealerId, { gateSubscription: false });
  const roles = await listDealerRoles(dealerId);
  sendSuccess(res, 'Dealer roles retrieved', roles);
}

/**
 * POST /dealer-roles
 * Creates a role for the caller's dealer.
 */
export async function createDealerRoleHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateDealerRoleBody;
  const dealerId = await resolveManagedDealerId(req, body.dealerId, { gateSubscription: false });
  const role = await createDealerRole({
    dealerId,
    roleName: body.roleName,
    capabilities: body.capabilities,
  });
  sendSuccess(res, 'Dealer role created', role, StatusCodes.CREATED);
}

/**
 * PATCH /dealer-roles/:id
 * Updates a role owned by the caller's dealer.
 */
export async function updateDealerRoleHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerRoleIdParams;
  const body = req.body as UpdateDealerRoleBody;
  const current = await getDealerRoleOrThrow(id);
  await assertManagedDealerMatches(req, current.dealerId);
  const role = await updateDealerRole(id, body);
  sendSuccess(res, 'Dealer role updated', role);
}

/**
 * DELETE /dealer-roles/:id
 * Deletes a role owned by the caller's dealer (members drop to read-only default).
 */
export async function deleteDealerRoleHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as DealerRoleIdParams;
  const current = await getDealerRoleOrThrow(id);
  await assertManagedDealerMatches(req, current.dealerId);
  await deleteDealerRole(id);
  sendSuccess(res, 'Dealer role deleted', {});
}

/**
 * POST /dealer-roles/assign
 * Assigns a role to an employee (or clears it with roleId=null).
 */
export async function assignDealerRoleHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as AssignDealerRoleBody;
  const dealerId = await resolveManagedDealerId(req, body.dealerId, { gateSubscription: false });
  const row = await assignRoleToUser({ dealerId, userId: body.userId, roleId: body.roleId });
  sendSuccess(res, 'Role assignment updated', row);
}
