import { z } from 'zod';
import type { RefinementCtx } from 'zod';
import { vehicleBodyFields } from './vehicle.validation';
import { personSchema } from './person.validation';

/** Optional money field: blank/null → undefined; otherwise positive-or-zero with ≤2 decimals. */
const priceField = z
  .preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z
      .coerce.number()
      .nonnegative('Price cannot be negative')
      .max(999_999_999_999.99, 'Price is too large')
      // Check decimals on the string form (shortest round-trippable) — `Math.round(n*100)===n*100`
      // gives float false-negatives (e.g. 19.99*100 = 1998.9999…) that reject valid rupee amounts.
      .refine((n) => Number.isFinite(n) && /^\d+(\.\d{1,2})?$/.test(n.toString()), 'At most 2 decimal places'),
  )
  .optional();

const priceFields = {
  purchasePrice: priceField,
  salePrice: priceField,
  priceCurrency: z.string().trim().length(3, 'Use a 3-letter currency code').optional(),
};

/**
 * Cross-field rules for a process body: at most one SELLER and one BUYER, and a price may be set
 * only when the matching counterparty (seller for purchase, buyer for sale) is present.
 */
function refineProcessBody(
  val: { persons?: { personType: string }[]; purchasePrice?: number; salePrice?: number },
  ctx: RefinementCtx,
): void {
  const persons = val.persons ?? [];
  const sellers = persons.filter((p) => p.personType === 'SELLER').length;
  const buyers = persons.filter((p) => p.personType === 'BUYER').length;
  if (sellers > 1) ctx.addIssue({ code: 'custom', path: ['persons'], message: 'At most one seller per process' });
  if (buyers > 1) ctx.addIssue({ code: 'custom', path: ['persons'], message: 'At most one buyer per process' });
  if (val.purchasePrice != null && sellers === 0)
    ctx.addIssue({ code: 'custom', path: ['purchasePrice'], message: 'Purchase price requires a seller' });
  if (val.salePrice != null && buyers === 0)
    ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'Sale price requires a buyer' });
}

const vehicleProcessBodyFields = {
  vehicleId: z.string().uuid('Invalid vehicle ID'),
  dealerId: z.string().uuid('Invalid dealer ID').optional(),
  status: z.string().min(1, 'Status is required').max(255),
  processDate: z.string().min(1, 'Process date is required'),
  persons: z.array(personSchema).min(1, 'At least one person is required'),
  ...priceFields,
};

export const createVehicleProcessSchema = z.object({
  body: z.object(vehicleProcessBodyFields).superRefine(refineProcessBody),
});

export const updateVehicleProcessSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
  body: z.object(vehicleProcessBodyFields).superRefine(refineProcessBody),
});

export const getVehicleProcessByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
});

export const getVehicleProcessDetailsSchema = getVehicleProcessByIdSchema;

export const listVehicleProcessesSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
});

const optionalProcessDate = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined) {
      return undefined;
    }
    const t = v.trim();
    return t.length === 0 ? undefined : t;
  })
  .refine((s) => s === undefined || !Number.isNaN(Date.parse(s)), {
    message: 'Invalid process date',
  });

const startUploadPhotoSchema = z.object({
  category: z.string().min(1, 'Category is required').max(255),
  imageName: z.string().min(1, 'Image name is required').max(255),
});

const startProcessReferenceSchema = z.object({
  referenceId: z.string().uuid('Invalid reference ID'),
  referenceType: z.enum(['BUY', 'SELL'], { required_error: 'Reference type is required' }),
});

/**
 * POST /vehicle-processes/start — upsert vehicle by registrationNumber, then create process (Pending, JWT dealer).
 */
export const startVehicleProcessWithVehicleSchema = z.object({
  body: z
    .object({
      ...vehicleBodyFields,
      processDate: optionalProcessDate,
      dealerId: z.string().uuid('Invalid dealer ID').optional(),
      /** Optional; omit or use [] to create only the process with no persons. */
      persons: z.array(personSchema).optional(),
      /** Optional; omit or use [] to skip upload photo rows. */
      uploadPhotos: z.array(startUploadPhotoSchema).optional(),
      /** Optional; omit or use [] to skip process reference rows (buyer/seller). */
      processReferences: z.array(startProcessReferenceSchema).optional(),
      ...priceFields,
    })
    .superRefine(refineProcessBody),
});

export type CreateVehicleProcessBody = z.infer<typeof createVehicleProcessSchema>['body'];
export type UpdateVehicleProcessBody = z.infer<typeof updateVehicleProcessSchema>['body'];
export type VehicleProcessIdParams = z.infer<typeof getVehicleProcessByIdSchema>['params'];
export type StartVehicleProcessWithVehicleBody = z.infer<
  typeof startVehicleProcessWithVehicleSchema
>['body'];

