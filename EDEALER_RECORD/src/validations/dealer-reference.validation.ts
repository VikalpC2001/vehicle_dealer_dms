import { z } from 'zod';

const dealerReferenceBodyFields = {
  dealerId: z.string().uuid('Invalid dealer ID').optional(),
  referenceName: z.string().min(1, 'Reference name is required').max(255),
  referenceNumber: z.string().min(1, 'Reference number is required').max(20),
};

export const createDealerReferenceSchema = z.object({
  body: z.object(dealerReferenceBodyFields),
});

export const updateDealerReferenceSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer reference ID'),
  }),
  body: z.object({
    referenceName: dealerReferenceBodyFields.referenceName,
    referenceNumber: dealerReferenceBodyFields.referenceNumber,
  }),
});

export const getDealerReferenceByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer reference ID'),
  }),
});

export const listDealerReferencesSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export const listDealerReferencesForDropdownSchema = z.object({
  query: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export type CreateDealerReferenceBody = z.infer<
  typeof createDealerReferenceSchema
>['body'];
export type UpdateDealerReferenceBody = z.infer<
  typeof updateDealerReferenceSchema
>['body'];
export type DealerReferenceIdParams = z.infer<
  typeof getDealerReferenceByIdSchema
>['params'];

