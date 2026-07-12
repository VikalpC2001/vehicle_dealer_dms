import { z } from 'zod';

/** Zod schema: optional string or JSON `null`; empty/whitespace becomes `null`. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Zod inferred chain type is verbose
function nullableTrimmedString(max: number, tooLongMessage: string) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null) return null;
      const t = v.trim();
      return t.length === 0 ? null : t;
    })
    .refine((s) => s === null || s.length <= max, { message: tooLongMessage });
}

const nullableRegistrationDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  })
  .refine((s) => s === null || !Number.isNaN(Date.parse(s)), {
    message: 'Invalid registration date',
  });

/** Shared vehicle snapshot fields (used by create/update vehicle and process-start). */
export const vehicleBodyFields = {
  registrationNumber: z.string().min(1, 'Registration number is required').max(50),
  chassisNumber: nullableTrimmedString(100, 'Chassis number must be at most 100 characters'),
  engineNumber: nullableTrimmedString(100, 'Engine number must be at most 100 characters'),
  vehicleType: nullableTrimmedString(50, 'Vehicle type must be at most 50 characters'),
  make: nullableTrimmedString(100, 'Make must be at most 100 characters'),
  model: nullableTrimmedString(100, 'Model must be at most 100 characters'),
  registrationDate: nullableRegistrationDate,
  manufactureMonth: z
    .union([z.number().int().min(1).max(12), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  manufactureYear: z
    .union([z.number().int().min(1900).max(3000), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
};

export const createVehicleSchema = z.object({
  body: z.object(vehicleBodyFields),
});

export const updateVehicleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid vehicle ID'),
  }),
  body: z.object(vehicleBodyFields),
});

export const getVehicleByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid vehicle ID'),
  }),
});

export const listVehiclesSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
});

/** GET /vehicles/history?registrationNumber= — per-vehicle buy/sell history (dealer-scoped). */
export const vehicleHistorySchema = z.object({
  query: z.object({
    registrationNumber: z.string().min(1, 'Registration number is required').max(50),
  }),
});

export type CreateVehicleBody = z.infer<typeof createVehicleSchema>['body'];
export type UpdateVehicleBody = z.infer<typeof updateVehicleSchema>['body'];
export type VehicleIdParams = z.infer<typeof getVehicleByIdSchema>['params'];
export type VehicleHistoryQuery = z.infer<typeof vehicleHistorySchema>['query'];
