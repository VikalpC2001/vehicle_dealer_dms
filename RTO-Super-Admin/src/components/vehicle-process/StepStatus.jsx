import { useEffect } from 'react'
import { useController, useFormContext } from 'react-hook-form'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { PROCESS_STATUSES } from '@/lib/processStatus'

// Open (default, status-less) plus the fixed terminal statuses, each with its own colour.
const STATUS_OPTIONS = [{ value: null, label: 'Open', colour: '#f59e0b' }, ...PROCESS_STATUSES]

/**
 * Step 5 — pick the process lifecycle status as an inline coloured card selector plus an optional,
 * centered "Deal Number" text box. Both bind to the shared wizard form. The status DEFAULTS from
 * whether a buyer was entered: SOLD is pre-selected once buyer details exist, otherwise Open — but an
 * explicit user pick (tracked via the form's `statusTouched`) is never overridden.
 *
 * @param {object} props
 * @param {boolean} [props.allowStatus] - When false the lifecycle-status cards are hidden (status
 *   stays at its default Open/null) and only the Deal Number field is shown. Lifecycle status is
 *   dealer-only, so agents create processes without setting one.
 */
export function StepStatus({ allowStatus = true }) {
  const { control, register, watch, setValue, getValues } = useFormContext()
  // Hook must stay unconditional; its value/onChange are only used when the cards render.
  const {
    field: { value: status, onChange: onStatusChange },
  } = useController({ name: 'status', control })

  // SOLD requires a buyer (backend rejects a SOLD-create with no BUYER → 4114). A buyer is produced
  // only when the buyer block is enabled AND name + mobile are filled (see assembleStartPayload).
  const hasBuyer =
    Boolean(watch('addBuyer')) &&
    Boolean(watch('buyerName')?.trim()) &&
    Boolean(watch('buyerMobile')?.trim())

  // Default the status from buyer presence — SOLD once a buyer is captured, Open otherwise — WITHOUT
  // overriding an explicit user pick. `statusTouched` lives in the shared form (set on a card click),
  // so the choice survives leaving and re-entering this step (which remounts StepStatus). This step is
  // reached only after the buyer step, so `hasBuyer` is already settled when the default applies.
  useEffect(() => {
    if (!allowStatus) return
    if (getValues('statusTouched')) {
      // Respect the user's choice; only correct an impossible SOLD-without-buyer (buyer later removed).
      if (status === 'SOLD' && !hasBuyer) onStatusChange(null)
      return
    }
    const desired = hasBuyer ? 'SOLD' : null
    if (status !== desired) onStatusChange(desired)
  }, [allowStatus, hasBuyer, status, getValues, onStatusChange])

  // Record that the user explicitly chose a status, so the default effect stops steering it.
  // shouldDirty is REQUIRED: the wizard re-seeds the form with resetForm(..., { keepDirtyValues: true })
  // on every OCR result, which resets any NON-dirty field to its default — a non-dirty statusTouched
  // would silently revert to false (re-arming the default) and the user's pick would be lost if they
  // went back and re-scanned a document. Marking it dirty keeps it through that reset.
  const pickStatus = (value) => {
    setValue('statusTouched', true, { shouldDirty: true })
    onStatusChange(value)
  }

  return (
    <div className="space-y-6">
      {allowStatus ? (
        <>
          <div className="text-center sm:text-left">
            <h3 className="text-sm font-semibold text-muted-foreground">Status</h3>
            <p className="text-xs text-muted-foreground">
              Leave it <span className="font-medium text-foreground">Open</span> to keep working on it, or set a final status.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {STATUS_OPTIONS.map((opt) => {
              const selected = status === opt.value
              const disabled = opt.value === 'SOLD' && !hasBuyer
              return (
                <button
                  key={opt.value ?? 'OPEN'}
                  type="button"
                  onClick={() => !disabled && pickStatus(opt.value)}
                  disabled={disabled}
                  aria-pressed={selected}
                  title={disabled ? 'Add a buyer in the Seller & Buyer step to mark this as Sold.' : undefined}
                  style={selected ? { borderColor: opt.colour, boxShadow: `0 0 0 1px ${opt.colour}` } : undefined}
                  className={cn(
                    'relative flex min-w-[7.5rem] flex-1 basis-32 flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors sm:max-w-[10rem]',
                    selected ? 'border-transparent' : 'border-border hover:border-muted-foreground/40',
                    disabled && 'cursor-not-allowed opacity-40 hover:border-border'
                  )}
                >
                  {selected && <Check className="absolute right-2 top-2 h-4 w-4" style={{ color: opt.colour }} />}
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: opt.colour }} />
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </button>
              )
            })}
          </div>

          {!hasBuyer && (
            <p className="text-center text-xs text-muted-foreground">
              Add a buyer in the <span className="font-medium text-foreground">Seller &amp; Buyer</span> step to
              mark this process as <span className="font-medium text-foreground">Sold</span>.
            </p>
          )}
        </>
      ) : (
        <p className="text-center text-xs text-muted-foreground sm:text-left">
          Lifecycle status is set by the dealer.
        </p>
      )}

      <div className="mx-auto w-full max-w-xs space-y-2 text-center">
        <Label htmlFor="dealNumber">Deal Number</Label>
        <Input id="dealNumber" placeholder="e.g. DL-2026-014" className="text-center" {...register('dealNumber')} />
        <p className="text-xs text-muted-foreground">Optional</p>
      </div>
    </div>
  )
}
