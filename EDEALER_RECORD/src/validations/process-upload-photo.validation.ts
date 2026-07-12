import { z } from 'zod';

const photoFields = {
  category: z.string().min(1, 'Category is required').max(255),
  imageName: z.string().min(1, 'Image name is required').max(255),
};

const processIdField = z.string().uuid('Invalid process ID');

export const createProcessUploadPhotoSchema = z.object({
  body: z.object({
    processId: processIdField,
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    ...photoFields,
  }),
});

export const bulkCreateProcessUploadPhotosSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    items: z
      .array(
        z.object({
          processId: processIdField,
          category: photoFields.category,
          imageName: photoFields.imageName,
        }),
      )
      .min(1, 'At least one item is required'),
  }),
});

export const listProcessUploadPhotosSchema = z.object({
  query: z.object({
    processId: processIdField,
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export const getProcessUploadPhotoByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process upload photo ID'),
  }),
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export const updateProcessUploadPhotoSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process upload photo ID'),
  }),
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
  body: z.object(photoFields),
});

export const deleteProcessUploadPhotoSchema = getProcessUploadPhotoByIdSchema;

export type CreateProcessUploadPhotoBody = z.infer<
  typeof createProcessUploadPhotoSchema
>['body'];
export type BulkCreateProcessUploadPhotosBody = z.infer<
  typeof bulkCreateProcessUploadPhotosSchema
>['body'];
export type UpdateProcessUploadPhotoBody = z.infer<
  typeof updateProcessUploadPhotoSchema
>['body'];
export type ProcessUploadPhotoIdParams = z.infer<
  typeof getProcessUploadPhotoByIdSchema
>['params'];
