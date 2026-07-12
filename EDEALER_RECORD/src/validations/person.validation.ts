import { z } from 'zod';

/** Shared mutable person fields (create / update body). */
export const personBodyFields = {
  personName: z.string().min(1, 'Person name is required').max(255),
  address: z.string().optional().nullable(),
  mobileNumber: z.string().min(1, 'Mobile number is required').max(20),
  personType: z.enum(['SELLER', 'BUYER'], { required_error: 'Person type is required' }),
};

/** One person object (e.g. nested in vehicle-process payloads). */
export const personSchema = z.object(personBodyFields);

export const createPersonSchema = z.object({
  body: z.object({
    processId: z.string().uuid('Invalid process ID'),
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    ...personBodyFields,
  }),
});

export const listPersonsSchema = z.object({
  query: z.object({
    processId: z.string().uuid('Invalid process ID'),
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
  }),
});

const optionalDealerIdQuery = z.object({
  dealerId: z.string().uuid('Invalid dealer ID').optional(),
});

export const getPersonByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid person ID'),
  }),
  query: optionalDealerIdQuery,
});

export const updatePersonSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid person ID'),
  }),
  query: optionalDealerIdQuery,
  body: z.object(personBodyFields),
});

export const deletePersonSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid person ID'),
  }),
  query: optionalDealerIdQuery,
});

export type CreatePersonBody = z.infer<typeof createPersonSchema>['body'];
export type UpdatePersonBody = z.infer<typeof updatePersonSchema>['body'];
export type PersonIdParams = z.infer<typeof getPersonByIdSchema>['params'];
