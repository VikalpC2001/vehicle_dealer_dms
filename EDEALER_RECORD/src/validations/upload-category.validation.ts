import { z } from 'zod';

export const createUploadCategorySchema = z.object({
  body: z.object({
    categoryName: z.string().min(1, 'Category name is required').max(255),
    bothSide: z.boolean(),
    processApi: z.string().max(512).nullish(),
  }),
});

export const updateUploadCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
  body: z.object({
    categoryName: z.string().min(1, 'Category name is required').max(255),
    bothSide: z.boolean(),
    processApi: z.string().max(512).nullish(),
  }),
});

export const getUploadCategoryByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
});

/** GET /upload-categories — no query params (full list, unpaginated). */
export const listUploadCategoriesSchema = z.object({});

const updateUploadCategoryOrderItemSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  categoryName: z.string().max(255).optional(),
  orderRank: z.number().int().min(0, 'orderRank must be a non-negative integer'),
});

export const updateUploadCategoryOrderRanksSchema = z.object({
  body: z
    .array(updateUploadCategoryOrderItemSchema)
    .min(1, 'At least one item is required')
    .refine(
      (arr) => new Set(arr.map((i) => i.categoryId)).size === arr.length,
      'Duplicate categoryId not allowed',
    ),
});

export type CreateUploadCategoryBody = z.infer<typeof createUploadCategorySchema>['body'];
export type UpdateUploadCategoryBody = z.infer<typeof updateUploadCategorySchema>['body'];
export type UploadCategoryIdParams = z.infer<typeof getUploadCategoryByIdSchema>['params'];
export type UpdateUploadCategoryOrderRanksBody = z.infer<
  typeof updateUploadCategoryOrderRanksSchema
>['body'];
