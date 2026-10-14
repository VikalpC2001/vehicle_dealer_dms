/**
 * Shared react-hook-form schema + defaults for the create-vehicle-process wizard.
 * Lifted out of the (now split) StepVerifyDetails so the wizard can own ONE form that
 * spans steps 2–5 (Vehicle → Seller & Buyer → References & Price → Status) via FormProvider.
 * No React or network code here so it stays easy to reason about and reuse.
 */
import { z } from 'zod'

const mobileField = z
  .string()
  .refine((v) => v === '' || /^[+0-9][0-9 -]{6,19}$/.test(v), 'Enter a valid mobile number')
  .optional()
  .or(z.literal(''))

/** Required mobile — the RC book has no phone, so the dealer must enter the seller's mobile. */
const requiredMobileField = z
  .string()
  .min(1, 'Mobile number is required')
  .refine((v) => /^[+0-9][0-9 -]{6,19}$/.test(v), 'Enter a valid mobile number')

/** Optional money string: empty OR a non-negative number with ≤2 decimals. */
const priceField = z
  .string()
  .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Enter a valid amount (up to 2 decimals)')
  .optional()
  .or(z.literal(''))

export const vehicleProcessSchema = z
  .object({
    registrationNumber: z.string().min(1, 'Registration number is required').max(50),
    chassisNumber: z.string().max(100).optional().or(z.literal('')),
    engineNumber: z.string().max(100).optional().or(z.literal('')),
    vehicleType: z.string().max(50).optional().or(z.literal('')),
    make: z.string().max(100).optional().or(z.literal('')),
    model: z.string().max(100).optional().or(z.literal('')),
    registrationDate: z.string().optional().or(z.literal('')),
    manufactureMonth: z.string().optional().or(z.literal('')),
    manufactureYear: z.string().optional().or(z.literal('')),
    sellerName: z.string().min(1, 'Seller name is required').max(255),
    sellerMobile: requiredMobileField,
    sellerAddress: z.string().optional().or(z.literal('')),
    sellerReferenceId: z.string().optional().or(z.literal('')),
    purchasePrice: priceField,
    addBuyer: z.boolean().optional(),
    buyerName: z.string().max(255).optional().or(z.literal('')),
    buyerMobile: mobileField,
    buyerAddress: z.string().optional().or(z.literal('')),
    buyerReferenceId: z.string().optional().or(z.literal('')),
    salePrice: priceField,
    // Fixed lifecycle status chosen at creation; null = OPEN (status-less). Deal number is optional free text.
    status: z.enum(['SOLD', 'COMPLETE', 'SCRAP']).nullable().optional(),
    // UI-only flag: true once the user explicitly picks a status card, so the buyer-derived default
    // (SOLD when a buyer exists) stops steering it. Not sent to the API (assembleStartPayload ignores it).
    statusTouched: z.boolean().optional(),
    dealNumber: z.string().max(100, 'Deal number is too long').optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    if (val.addBuyer) {
      const name = (val.buyerName ?? '').trim()
      const mobile = (val.buyerMobile ?? '').trim()
      if (name || mobile) {
        if (!name) ctx.addIssue({ code: 'custom', path: ['buyerName'], message: 'Buyer name is required' })
        if (!mobile) ctx.addIssue({ code: 'custom', path: ['buyerMobile'], message: 'Buyer mobile is required' })
      }
    }
  })

export const defaultVehicleProcessValues = {
  registrationNumber: '',
  chassisNumber: '',
  engineNumber: '',
  vehicleType: '',
  make: '',
  model: '',
  registrationDate: '',
  manufactureMonth: '',
  manufactureYear: '',
  sellerName: '',
  sellerMobile: '',
  sellerAddress: '',
  sellerReferenceId: '',
  purchasePrice: '',
  addBuyer: false,
  buyerName: '',
  buyerMobile: '',
  buyerAddress: '',
  buyerReferenceId: '',
  salePrice: '',
  status: null,
  statusTouched: false,
  dealNumber: '',
}
