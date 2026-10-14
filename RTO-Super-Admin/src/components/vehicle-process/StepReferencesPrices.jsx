import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Field, RefSelect } from './verifyFields'

/**
 * Step 4 — References & Price. Purchase price + seller reference sit inline (side by side); sale
 * price + buyer reference (also inline) appear ONLY when a buyer was added (`addBuyer`, set in step 3
 * by a buyer-ID upload/scan or manual entry). Everything here is optional — leave any field blank and
 * continue. Reference dropdowns only render when the dealer has references (agent mode has none, so
 * the row shows the price field alone).
 *
 * @param {object} props
 * @param {Array<{referenceId,referenceName,referenceNumber}>} [props.references]
 */
export function StepReferencesPrices({ references = [] }) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext()

  const sellerReferenceId = watch('sellerReferenceId')
  const buyerReferenceId = watch('buyerReferenceId')
  const addBuyer = watch('addBuyer')

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Seller</h3>
          <p className="text-xs text-muted-foreground">
            Record what you paid the seller and, optionally, who referred them. All optional — leave blank and continue.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Purchase price (₹)" id="purchasePrice" error={errors.purchasePrice?.message}>
            <Input id="purchasePrice" type="number" min={0} step="0.01" placeholder="0.00" {...register('purchasePrice')} />
          </Field>
          {references.length > 0 && (
            <RefSelect
              id="sellerReferenceId"
              label="Seller reference (optional)"
              value={sellerReferenceId}
              onValueChange={(val) => setValue('sellerReferenceId', val, { shouldDirty: true })}
              references={references}
            />
          )}
        </div>
      </section>

      {addBuyer && (
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Buyer</h3>
            <p className="text-xs text-muted-foreground">
              Record what the buyer paid and, optionally, who referred them.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Sale price (₹)" id="salePrice" error={errors.salePrice?.message}>
              <Input id="salePrice" type="number" min={0} step="0.01" placeholder="0.00" {...register('salePrice')} />
            </Field>
            {references.length > 0 && (
              <RefSelect
                id="buyerReferenceId"
                label="Buyer reference (optional)"
                value={buyerReferenceId}
                onValueChange={(val) => setValue('buyerReferenceId', val, { shouldDirty: true })}
                references={references}
              />
            )}
          </div>
        </section>
      )}
    </div>
  )
}
