import { z } from 'zod';

const photoFields = {
  category: z.string().min(1, 'Category is required').max(255),
  imageName: z.string().min(1, 'Image name is required').max(255),
};

/** Photo kind: a document scan/upload or a free-form vehicle photo (capped at 5 per process). */
const kindField = z.enum(['DOCUMENT', 'VEHICLE']);

const processIdField = z.string().uuid('Invalid process ID');

export const createProcessUploadPhotoSchema = z.object({
  body: z.object({
    processId: processIdField,
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    kind: kindField.optional(),
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

/** Star (set primary) a vehicle photo: params `{ id }` + optional `?dealerId`, no body. */
export const starProcessUploadPhotoSchema = getProcessUploadPhotoByIdSchema;

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
