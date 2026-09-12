import { z } from 'zod';

const dealerTaskTemplateBodyFields = {
  dealerId: z.string().uuid('Invalid dealer ID').optional(),
  templateName: z.string().min(1, 'Template name is required').max(255),
};

export const createDealerTaskTemplateSchema = z.object({
  body: z.object(dealerTaskTemplateBodyFields),
});

export const updateDealerTaskTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer task template ID'),
  }),
  body: z.object({
    templateName: dealerTaskTemplateBodyFields.templateName,
  }),
});

export const getDealerTaskTemplateByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer task template ID'),
  }),
});

export const listDealerTaskTemplatesSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

export type CreateDealerTaskTemplateBody = z.infer<
  typeof createDealerTaskTemplateSchema
>['body'];
export type UpdateDealerTaskTemplateBody = z.infer<
  typeof updateDealerTaskTemplateSchema
>['body'];
export type DealerTaskTemplateIdParams = z.infer<
  typeof getDealerTaskTemplateByIdSchema
>['params'];
