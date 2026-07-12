import { z } from 'zod';

export const createRtoServiceSchema = z.object({
  body: z.object({
    serviceName: z.string().min(1, 'Service name is required').max(255),
    shortName: z.string().min(1, 'Short name is required').max(50),
  }),
});

export const updateRtoServiceSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid RTO service ID'),
  }),
  body: z.object({
    serviceName: z.string().min(1, 'Service name is required').max(255),
    shortName: z.string().min(1, 'Short name is required').max(50),
  }),
});

export const getRtoServiceByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid RTO service ID'),
  }),
});

export const listRtoServicesSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
});

/** Single item for bulk orderRank update. serviceName/shortName optional (for client display); only orderRank is updated. */
const updateOrderRankItemSchema = z.object({
  serviceId: z.string().uuid('Invalid service ID'),
  serviceName: z.string().max(255).optional(),
  shortName: z.string().max(50).optional(),
  orderRank: z.number().int().min(0, 'orderRank must be a non-negative integer'),
});

export const updateOrderRanksSchema = z.object({
  body: z
    .array(updateOrderRankItemSchema)
    .min(1, 'At least one item is required')
    .refine(
      (arr) => new Set(arr.map((i) => i.serviceId)).size === arr.length,
      'Duplicate serviceId not allowed',
    ),
});

export type CreateRtoServiceBody = z.infer<typeof createRtoServiceSchema>['body'];
export type UpdateRtoServiceBody = z.infer<typeof updateRtoServiceSchema>['body'];
export type RtoServiceIdParams = z.infer<typeof getRtoServiceByIdSchema>['params'];
export type UpdateOrderRanksBody = z.infer<typeof updateOrderRanksSchema>['body'];

