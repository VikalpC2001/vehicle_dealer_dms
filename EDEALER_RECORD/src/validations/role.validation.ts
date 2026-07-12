import { z } from 'zod';
import { RoleType } from '@prisma/client';

const roleTypeSchema = z.nativeEnum(RoleType, {
  errorMap: () => ({ message: 'roleType must be DEALER or AGENT' }),
});

const roleBodyFields = {
  roleName: z.string().min(1, 'Role name is required').max(255),
  roleType: roleTypeSchema,
  typeId: z.string().uuid('typeId must be a valid UUID'),
};

export const createRoleSchema = z.object({
  body: z.object(roleBodyFields),
});

export const updateRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid role ID'),
  }),
  body: z.object(roleBodyFields),
});

export const getRoleByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid role ID'),
  }),
});

export const listRolesSchema = z.object({
  query: z.object({
    typeId: z.string().uuid('typeId is required and must be a valid UUID'),
    roleType: roleTypeSchema.optional(),
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
});

export type CreateRoleBody = z.infer<typeof createRoleSchema>['body'];
export type UpdateRoleBody = z.infer<typeof updateRoleSchema>['body'];
export type RoleIdParams = z.infer<typeof getRoleByIdSchema>['params'];
export type ListRolesQuery = z.infer<typeof listRolesSchema>['query'];
