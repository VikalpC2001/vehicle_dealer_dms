import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from './verifyFields'

/**
 * Step 3 — Seller & Buyer. The seller (= vehicle owner) is always shown and required. The buyer
 * block is ALWAYS shown; the buyer is entered manually (name + mobile; address optional). When a
 * buyer ID was uploaded in step 1 its OCR pre-fills the buyer name/address (see the wizard's runOcr) —
 * there is no in-step buyer-ID upload/scan control. `buyerIdUploaded` reflects whether a buyer ID was
 * ACTUALLY uploaded in step 1 (not merely configured); it tailors the helper text and keeps a
 * captured buyer marked. `addBuyer` tracks whether the process has a buyer — true iff the buyer ID
 * was uploaded in step 1 OR a buyer name/mobile is present — so `assembleStartPayload` emits the BUYER
 * and step 4 reveals the buyer price/reference. It is recomputed on every change (both directions):
 * clearing the buyer flips it back off and discards the now-orphaned sale price / buyer reference,
 * keeping the process seller-only.
 *
 * @param {object} props
 * @param {boolean} [props.buyerIdUploaded] - Whether a Buyer-ID document was uploaded in step 1.
 */
export function StepPersons({ buyerIdUploaded = false }) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext()

  const buyerName = watch('buyerName')
  const buyerMobile = watch('buyerMobile')

  // addBuyer mirrors the actual buyer state so the payload/step-4/review stay consistent: on when the
  // buyer ID was uploaded in step 1 or a buyer name/mobile exists, off otherwise. When there's no
  // buyer, drop the buyer-only downstream fields so a stale sale price / buyer reference can't leak.
  useEffect(() => {
    const hasBuyer = Boolean(buyerIdUploaded || buyerName?.trim() || buyerMobile?.trim())
    setValue('addBuyer', hasBuyer, { shouldDirty: true })
    if (!hasBuyer) {
      setValue('salePrice', '', { shouldDirty: true })
      setValue('buyerReferenceId', '', { shouldDirty: true })
    }
  }, [buyerIdUploaded, buyerName, buyerMobile, setValue])

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Seller / Owner</h3>
          <p className="text-xs text-muted-foreground">
            The vehicle owner is the seller — name &amp; address auto-fill from the RC book. The RC has no
            phone, so enter the seller&apos;s mobile. Seller details are required.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" id="sellerName" required error={errors.sellerName?.message}>
            <Input id="sellerName" placeholder="Owner name" {...register('sellerName')} />
          </Field>
          <Field label="Mobile Number" id="sellerMobile" required error={errors.sellerMobile?.message}>
            <Input id="sellerMobile" placeholder="9876543210" {...register('sellerMobile')} />
          </Field>
        </div>
        <Field label="Address" id="sellerAddress" error={errors.sellerAddress?.message}>
          <Textarea id="sellerAddress" placeholder="House no, street, area, city, state - pincode" {...register('sellerAddress')} />
        </Field>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Buyer</h3>
          <p className="text-xs text-muted-foreground">
            {buyerIdUploaded
              ? 'Buyer ID was uploaded in step 1 — verify the details below and add the mobile number.'
              : 'Enter the buyer details below, or leave blank if there is no buyer.'}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" id="buyerName" error={errors.buyerName?.message}>
            <Input id="buyerName" placeholder="Buyer name" {...register('buyerName')} />
          </Field>
          <Field label="Mobile Number" id="buyerMobile" error={errors.buyerMobile?.message}>
            <Input id="buyerMobile" placeholder="9876543210" {...register('buyerMobile')} />
          </Field>
        </div>
        <Field label="Address" id="buyerAddress" error={errors.buyerAddress?.message}>
          <Textarea id="buyerAddress" placeholder="Buyer address" {...register('buyerAddress')} />
        </Field>
      </section>
    </div>
  )
}
