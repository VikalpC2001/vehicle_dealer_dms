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
    // Optional flat upload key of the person's ID-proof photo, stored + linked to them on create.
    idImageName: z.string().min(1).max(512).optional(),
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
  body: z.object({
    ...personBodyFields,
    // Optional flat upload key of a new ID-proof photo — replaces the person's linked ID on update.
    idImageName: z.string().min(1).max(512).optional(),
  }),
});

export const deletePersonSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid person ID'),
  }),
  query: optionalDealerIdQuery,
});

/** POST /persons/change-buyer — cancel the active buyer + add a new one (with an optional ID photo). */
export const changeBuyerSchema = z.object({
  body: z.object({
    processId: z.string().uuid('Invalid process ID'),
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    personName: z.string().min(1, 'Buyer name is required').max(255),
    address: z.string().optional().nullable(),
    mobileNumber: z.string().min(1, 'Mobile number is required').max(20),
    buyerIdImageName: z.string().min(1).max(512).optional(),
  }),
});

export type CreatePersonBody = z.infer<typeof createPersonSchema>['body'];
export type UpdatePersonBody = z.infer<typeof updatePersonSchema>['body'];
export type PersonIdParams = z.infer<typeof getPersonByIdSchema>['params'];
export type ChangeBuyerBody = z.infer<typeof changeBuyerSchema>['body'];
