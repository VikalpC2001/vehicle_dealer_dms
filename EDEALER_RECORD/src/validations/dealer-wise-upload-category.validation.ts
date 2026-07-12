import { z } from 'zod';

export const createDealerWiseUploadCategorySchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    uploadCategoryId: z.string().uuid('Invalid upload category ID'),
    processApi: z.string().max(512).nullish(),
    isRequired: z.boolean(),
    isProcess: z.boolean(),
    isViewInStep: z.boolean(),
  }),
});

export const listDealerWiseUploadCategoriesSchema = z.object({
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

/** Same query as list; filters `isViewInStep === true` in the handler. */
export const listDealerWiseUploadCategoriesViewInStepSchema = z.object({
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export const getDealerWiseUploadCategoryByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dwuc ID'),
  }),
});

export const updateDealerWiseUploadCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dwuc ID'),
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
  dwucId: z.string().uuid('Invalid dwuc ID'),
  orderRank: z.number().int().min(0, 'orderRank must be a non-negative integer'),
});

/**
 * PUT /dealer-wise-upload-categories/order — ranks apply only within the given `dealerId`.
 */
export const updateDealerWiseUploadOrderRanksSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    items: z
      .array(updateOrderItemSchema)
      .min(1, 'At least one item is required')
      .refine(
        (arr) => new Set(arr.map((i) => i.dwucId)).size === arr.length,
        'Duplicate dwucId not allowed',
      ),
  }),
});

export type CreateDealerWiseUploadCategoryBody = z.infer<
  typeof createDealerWiseUploadCategorySchema
>['body'];
export type UpdateDealerWiseUploadCategoryBody = z.infer<
  typeof updateDealerWiseUploadCategorySchema
>['body'];
export type DealerWiseUploadCategoryIdParams = z.infer<
  typeof getDealerWiseUploadCategoryByIdSchema
>['params'];
export type UpdateDealerWiseUploadOrderRanksBody = z.infer<
  typeof updateDealerWiseUploadOrderRanksSchema
>['body'];
