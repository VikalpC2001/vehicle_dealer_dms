import { z } from 'zod';

export const createAgentWiseUploadCategorySchema = z.object({
  body: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
    uploadCategoryId: z.string().uuid('Invalid upload category ID'),
    processApi: z.string().max(512).nullish(),
    isRequired: z.boolean(),
    isProcess: z.boolean(),
    isViewInStep: z.boolean(),
  }),
});

export const listAgentWiseUploadCategoriesSchema = z.object({
  query: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
  }),
});

/** Same query as list; filters `isViewInStep === true` in the handler. */
export const listAgentWiseUploadCategoriesViewInStepSchema = z.object({
  query: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
  }),
});

export const getAgentWiseUploadCategoryByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid awuc ID'),
  }),
});

export const updateAgentWiseUploadCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid awuc ID'),
  }),
  body: z.object({
    uploadCategoryId: z.string().uuid('Invalid upload category ID'),
    processApi: z.string().max(512).nullish(),
    isRequired: z.boolean(),
    isProcess: z.boolean(),
    isViewInStep: z.boolean(),
  }),
});

const updateOrderItemSchema = z.object({
  awucId: z.string().uuid('Invalid awuc ID'),
  orderRank: z.number().int().min(0, 'orderRank must be a non-negative integer'),
});

/**
 * PUT /agent-wise-upload-categories/order — ranks apply only within the given `agentId`.
 */
export const updateAgentWiseUploadOrderRanksSchema = z.object({
  body: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
    items: z
      .array(updateOrderItemSchema)
      .min(1, 'At least one item is required')
      .refine(
        (arr) => new Set(arr.map((i) => i.awucId)).size === arr.length,
        'Duplicate awucId not allowed',
      ),
  }),
});

export type CreateAgentWiseUploadCategoryBody = z.infer<
  typeof createAgentWiseUploadCategorySchema
>['body'];
export type UpdateAgentWiseUploadCategoryBody = z.infer<
  typeof updateAgentWiseUploadCategorySchema
>['body'];
export type AgentWiseUploadCategoryIdParams = z.infer<
  typeof getAgentWiseUploadCategoryByIdSchema
>['params'];
export type UpdateAgentWiseUploadOrderRanksBody = z.infer<
  typeof updateAgentWiseUploadOrderRanksSchema
>['body'];
