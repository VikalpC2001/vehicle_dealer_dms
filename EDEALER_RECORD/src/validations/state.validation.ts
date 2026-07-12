import { z } from 'zod';

export const listStatesForDropdownSchema = z.object({});

export const createStateSchema = z.object({
  body: z.object({
    stateName: z.string().min(1, 'State name is required').max(255),
  }),
});

export const updateStateSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid state ID'),
  }),
  body: z.object({
    stateName: z.string().min(1, 'State name is required').max(255),
  }),
});

export const getStateByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid state ID'),
  }),
});

export const listStatesSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
});

export type CreateStateBody = z.infer<typeof createStateSchema>['body'];
export type UpdateStateBody = z.infer<typeof updateStateSchema>['body'];
export type StateIdParams = z.infer<typeof getStateByIdSchema>['params'];

