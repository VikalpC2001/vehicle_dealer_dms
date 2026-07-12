import { z } from 'zod';

const roleTypeSchema = z.enum(['DEALER', 'AGENT']);

const moduleSyncItemSchema = z.object({
  moduleId: z.string().uuid('Invalid module ID').optional(),
  moduleName: z.string().min(1, 'moduleName is required').max(255),
  description: z.string().nullable().optional(),
});

/**
 * POST /rbac/modules/sync
 */
export const syncModulesSchema = z.object({
  body: z.object({
    moduleType: roleTypeSchema,
    modules: z.array(moduleSyncItemSchema).min(1, 'At least one module is required'),
  }),
});

const pageSyncItemSchema = z.object({
  pageId: z.string().uuid('Invalid page ID').optional(),
  pageName: z.string().min(1, 'pageName is required').max(255),
  slug: z
    .string()
    .min(1, 'slug is required')
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'slug must be URL-safe (letters, numbers, hyphens)'),
  description: z.string().nullable().optional(),
});

/**
 * POST /rbac/pages/sync
 */
export const syncPagesSchema = z.object({
  body: z.object({
    moduleId: z.string().uuid('Invalid module ID'),
    pages: z.array(pageSyncItemSchema),
  }),
});

const pageActionSyncItemSchema = z.object({
  actionId: z.string().uuid('Invalid action ID').optional(),
  actionName: z.string().min(1, 'actionName is required').max(64),
  label: z.string().max(128).nullable().optional(),
});

/**
 * POST /rbac/page-actions/sync
 */
export const syncPageActionsSchema = z.object({
  body: z.object({
    pageId: z.string().uuid('Invalid page ID'),
    actions: z.array(pageActionSyncItemSchema),
  }),
});

/**
 * GET /rbac/catalog?moduleType=DEALER
 */
export const getRbacCatalogSchema = z.object({
  query: z.object({
    moduleType: roleTypeSchema,
  }),
});

export type SyncModulesBody = z.infer<typeof syncModulesSchema>['body'];
export type SyncPagesBody = z.infer<typeof syncPagesSchema>['body'];
export type SyncPageActionsBody = z.infer<typeof syncPageActionsSchema>['body'];
export type GetRbacCatalogQuery = z.infer<typeof getRbacCatalogSchema>['query'];
