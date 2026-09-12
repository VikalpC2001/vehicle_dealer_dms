import { z } from 'zod';
import { ALL_CAPABILITY_KEYS, type CapabilityKey } from '../config/dealer-capabilities';

/** A single capability key must be one of the catalog keys (rejects unknown keys with 4220). */
const capabilityKeySchema = z.enum(
  ALL_CAPABILITY_KEYS as [CapabilityKey, ...CapabilityKey[]],
);

/** An array of capability keys, de-duplicated at the schema level. */
const capabilitiesSchema = z
  .array(capabilityKeySchema)
  .refine((arr) => new Set(arr).size === arr.length, 'Duplicate capability keys are not allowed');

/**
 * POST /dealer-roles
 */
export const createDealerRoleSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    roleName: z.string().trim().min(1, 'Role name is required').max(255),
    capabilities: capabilitiesSchema,
  }),
});

/**
 * PATCH /dealer-roles/:id
 */
export const updateDealerRoleSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid role ID') }),
  body: z
    .object({
      roleName: z.string().trim().min(1, 'Role name is required').max(255).optional(),
      capabilities: capabilitiesSchema.optional(),
    })
    .refine(
      (b) => b.roleName !== undefined || b.capabilities !== undefined,
      'Provide roleName and/or capabilities to update',
    ),
});

/**
 * DELETE /dealer-roles/:id
 */
export const dealerRoleIdParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid role ID') }),
});

/**
 * GET /dealer-roles
 */
export const listDealerRolesSchema = z.object({
  query: z.object({ dealerId: z.string().uuid('Invalid dealer ID').optional() }).optional(),
});

/**
 * POST /dealer-roles/assign
 */
export const assignDealerRoleSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    userId: z.string().uuid('Invalid user ID'),
    roleId: z.string().uuid('Invalid role ID').nullable(),
  }),
});

export type CreateDealerRoleBody = z.infer<typeof createDealerRoleSchema>['body'];
export type UpdateDealerRoleBody = z.infer<typeof updateDealerRoleSchema>['body'];
export type DealerRoleIdParams = z.infer<typeof dealerRoleIdParamsSchema>['params'];
export type AssignDealerRoleBody = z.infer<typeof assignDealerRoleSchema>['body'];
