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
 * Cross-field rules for a process body: at most one SELLER and one BUYER. Prices are independent
 * process attributes — `purchasePrice`/`salePrice` may be recorded regardless of whether a
 * seller/buyer person is present (a dealer records what they paid even before capturing the party).
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
}

const vehicleProcessBodyFields = {
  vehicleId: z.string().uuid('Invalid vehicle ID'),
  dealerId: z.string().uuid('Invalid dealer ID').optional(),
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
  // `persons` is optional on update: person management lives in the /persons endpoints (incl.
  // change-buyer, which keeps CANCELLED buyers on the process). Status/price-only updates omit it
  // and leave persons untouched — re-sending them would resurface a CANCELLED buyer as a 2nd buyer.
  body: z
    .object({
      ...vehicleProcessBodyFields,
      persons: z.array(personSchema).min(1, 'At least one person is required').optional(),
    })
    .superRefine(refineProcessBody),
});

export const getVehicleProcessByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
});

export const getVehicleProcessDetailsSchema = getVehicleProcessByIdSchema;

/** PATCH /vehicle-processes/:id/agent-status — move an agent-created process on the agent board. */
export const updateVehicleProcessAgentStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
  body: z.object({
    agentStatusId: z.string().uuid('Invalid status ID'),
  }),
});

/** PATCH /vehicle-processes/:id/receipt — set/replace the agent-uploaded RTO receipt (flat upload key). */
export const setVehicleProcessReceiptSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
  body: z.object({
    imageName: z.string().min(1, 'Receipt file is required').max(512),
  }),
});

/** PATCH /vehicle-processes/:id/tracking — set/clear the RC-book tracking number (blank clears it). */
export const setVehicleProcessTrackingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
  body: z.object({
    trackingNumber: z.string().max(255, 'Tracking number is too long'),
  }),
});

/**
 * PATCH /vehicle-processes/:id/status — set or clear a process's fixed lifecycle status. `null`
 * clears it back to OPEN (subject to the open-uniqueness invariant). `dealerId?` is accepted for the
 * agent/admin managed-dealer passthrough, mirroring the other vehicle-process writes.
 */
export const setVehicleProcessStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    status: z.enum(['SOLD', 'COMPLETE', 'SCRAP']).nullable(),
  }),
});

/** PUT /vehicle-processes/:id/tags — full-replace the process's tags (empty array clears them). */
export const setVehicleProcessTagsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid process ID'),
  }),
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    tagIds: z.array(z.string().uuid('Invalid tag ID')),
  }),
});

export const listVehicleProcessesSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    // Which dealer's processes to list: an agent picks a dealer they manage; a super-admin may
    // narrow to one dealer. Ignored for a dealer caller (scoped to their own token dealer).
    dealerId: z.string().uuid('Invalid dealer ID').optional(),
    // Free-text search over the vehicle's registration number and any person's name.
    search: z.string().trim().max(255).optional(),
    // Narrow the list to processes carrying this tag (server-side, so pagination totals stay correct).
    tagId: z.string().uuid('Invalid tag ID').optional(),
    // Narrow by lifecycle status: a terminal value, or 'OPEN' for status-less (open) processes.
    status: z.enum(['SOLD', 'COMPLETE', 'SCRAP', 'OPEN']).optional(),
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
export type UpdateVehicleProcessAgentStatusBody = z.infer<
  typeof updateVehicleProcessAgentStatusSchema
>['body'];
export type SetVehicleProcessReceiptBody = z.infer<typeof setVehicleProcessReceiptSchema>['body'];
export type SetVehicleProcessTrackingBody = z.infer<typeof setVehicleProcessTrackingSchema>['body'];
export type SetVehicleProcessStatusBody = z.infer<typeof setVehicleProcessStatusSchema>['body'];
export type SetVehicleProcessTagsBody = z.infer<typeof setVehicleProcessTagsSchema>['body'];
export type StartVehicleProcessWithVehicleBody = z.infer<
  typeof startVehicleProcessWithVehicleSchema
>['body'];

