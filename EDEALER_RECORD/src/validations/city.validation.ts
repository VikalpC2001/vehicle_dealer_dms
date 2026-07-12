import { z } from 'zod';

export const listCitiesForDropdownByStateSchema = z.object({
  params: z.object({
    stateId: z.string().uuid('Invalid state ID'),
  }),
});

export const createCitySchema = z.object({
  body: z.object({
    stateId: z.string().uuid('Invalid state ID'),
    cityName: z.string().min(1, 'City name is required').max(255),
  }),
});

export const updateCitySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid city ID'),
  }),
  body: z.object({
    cityName: z.string().min(1, 'City name is required').max(255),
  }),
});

export const getCityByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid city ID'),
  }),
});

export const listCitiesSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    stateId: z.string().uuid('Invalid state ID').optional(),
  }),
});

export type CreateCityBody = z.infer<typeof createCitySchema>['body'];
export type UpdateCityBody = z.infer<typeof updateCitySchema>['body'];
export type CityIdParams = z.infer<typeof getCityByIdSchema>['params'];
export type CityDropdownByStateParams = z.infer<typeof listCitiesForDropdownByStateSchema>['params'];

