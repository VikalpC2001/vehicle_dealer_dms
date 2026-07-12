import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { IdProofAutofill } from './IdProofAutofill'

const mobileField = z
  .string()
  .refine((v) => v === '' || /^[+0-9][0-9 -]{6,19}$/.test(v), 'Enter a valid mobile number')
  .optional()
  .or(z.literal(''))

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
  sellerName: z.string().max(255).optional().or(z.literal('')),
  sellerMobile: mobileField,
  sellerAddress: z.string().optional().or(z.literal('')),
  sellerReferenceId: z.string().optional().or(z.literal('')),
  purchasePrice: priceField,
  addBuyer: z.boolean().optional(),
  buyerName: z.string().max(255).optional().or(z.literal('')),
  buyerMobile: mobileField,
  buyerAddress: z.string().optional().or(z.literal('')),
  salePrice: priceField,
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
  salePrice: '',
}

const NO_REFERENCE = '__none__'

/**
 * Step 2 — verify & edit the auto-filled vehicle + seller details.
 *
 * @param {object} props
 * @param {object} props.defaultValues - Seeded from OCR (+ any prior edits).
 * @param {Array<{referenceId,referenceName,referenceNumber}>} props.references
 * @param {(values: object) => void} props.onSubmit - Advances to review with the values.
 * @param {string} props.formId - Lets the wizard footer submit this form by id.
 */
export function StepVerifyDetails({ defaultValues, references = [], onSubmit, formId, buyerIdInStep1 = false }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(vehicleProcessSchema),
    defaultValues: { ...defaultVehicleProcessValues, ...defaultValues },
  })

  // Re-seed when OCR results arrive, keeping any values the user already changed.
  useEffect(() => {
    reset({ ...defaultVehicleProcessValues, ...defaultValues }, { keepDirtyValues: true })
  }, [defaultValues, reset])

  const sellerReferenceId = watch('sellerReferenceId')
  const addBuyer = watch('addBuyer')

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Vehicle</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Registration Number" id="registrationNumber" required error={errors.registrationNumber?.message}>
            <Input id="registrationNumber" placeholder="MH12AB1234" {...register('registrationNumber')} />
          </Field>
          <Field label="Registration Date" id="registrationDate" error={errors.registrationDate?.message}>
            <Input id="registrationDate" type="date" {...register('registrationDate')} />
          </Field>
          <Field label="Make" id="make" error={errors.make?.message}>
            <Input id="make" placeholder="Maruti" {...register('make')} />
          </Field>
          <Field label="Model" id="model" error={errors.model?.message}>
            <Input id="model" placeholder="Swift" {...register('model')} />
          </Field>
          <Field label="Chassis Number" id="chassisNumber" error={errors.chassisNumber?.message}>
            <Input id="chassisNumber" placeholder="MBLJF16EDCGA07285" {...register('chassisNumber')} />
          </Field>
          <Field label="Engine Number" id="engineNumber" error={errors.engineNumber?.message}>
            <Input id="engineNumber" placeholder="JF16EBCGA06004" {...register('engineNumber')} />
          </Field>
          <Field label="Vehicle Type" id="vehicleType" error={errors.vehicleType?.message}>
            <Input id="vehicleType" placeholder="Car / Scooter" {...register('vehicleType')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mfg. Month" id="manufactureMonth" error={errors.manufactureMonth?.message}>
              <Input id="manufactureMonth" type="number" min={1} max={12} placeholder="6" {...register('manufactureMonth')} />
            </Field>
            <Field label="Mfg. Year" id="manufactureYear" error={errors.manufactureYear?.message}>
              <Input id="manufactureYear" type="number" min={1900} max={3000} placeholder="2019" {...register('manufactureYear')} />
            </Field>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Seller / Owner</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" id="sellerName" error={errors.sellerName?.message}>
            <Input id="sellerName" placeholder="Owner name" {...register('sellerName')} />
          </Field>
          <Field label="Mobile Number" id="sellerMobile" error={errors.sellerMobile?.message}>
            <Input id="sellerMobile" placeholder="9876543210" {...register('sellerMobile')} />
          </Field>
          <Field label="Purchase price (₹)" id="purchasePrice" error={errors.purchasePrice?.message}>
            <Input id="purchasePrice" type="number" min={0} step="0.01" placeholder="0.00" {...register('purchasePrice')} />
          </Field>
        </div>
        <Field label="Address" id="sellerAddress" error={errors.sellerAddress?.message}>
          <Textarea id="sellerAddress" placeholder="House no, street, area, city, state - pincode" {...register('sellerAddress')} />
        </Field>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Buyer (optional)</h3>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Add buyer now
            <Switch checked={Boolean(addBuyer)} onCheckedChange={(v) => setValue('addBuyer', v)} />
          </label>
        </div>
        {addBuyer && (
          <div className="space-y-4">
            {buyerIdInStep1 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Buyer ID was uploaded in step 1. Verify the details below and add the mobile number.
              </p>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
                <span className="text-xs text-muted-foreground">Have the buyer&apos;s ID? Auto-fill name &amp; address.</span>
                <IdProofAutofill
                  label="Upload buyer ID"
                  onExtracted={({ name, address }) => {
                    if (name) setValue('buyerName', name, { shouldDirty: true })
                    if (address) setValue('buyerAddress', address, { shouldDirty: true })
                  }}
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Name" id="buyerName" error={errors.buyerName?.message}>
                <Input id="buyerName" placeholder="Buyer name" {...register('buyerName')} />
              </Field>
              <Field label="Mobile Number" id="buyerMobile" error={errors.buyerMobile?.message}>
                <Input id="buyerMobile" placeholder="9876543210" {...register('buyerMobile')} />
              </Field>
              <Field label="Sale price (₹)" id="salePrice" error={errors.salePrice?.message}>
                <Input id="salePrice" type="number" min={0} step="0.01" placeholder="0.00" {...register('salePrice')} />
              </Field>
            </div>
            <Field label="Address" id="buyerAddress" error={errors.buyerAddress?.message}>
              <Textarea id="buyerAddress" placeholder="Buyer address" {...register('buyerAddress')} />
            </Field>
          </div>
        )}
      </section>

      {references.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Reference (optional)</h3>
          <div className="space-y-2 md:w-1/2">
            <Label htmlFor="sellerReferenceId">Who referred this vehicle?</Label>
            <Select
              value={sellerReferenceId || NO_REFERENCE}
              onValueChange={(value) =>
                setValue('sellerReferenceId', value === NO_REFERENCE ? '' : value)
              }
            >
              <SelectTrigger id="sellerReferenceId">
                <SelectValue placeholder="Select a reference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_REFERENCE}>No reference</SelectItem>
                {references.map((ref) => (
                  <SelectItem key={ref.referenceId} value={ref.referenceId}>
                    {ref.referenceName} ({ref.referenceNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      )}
    </form>
  )
}

function Field({ label, id, error, required, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
