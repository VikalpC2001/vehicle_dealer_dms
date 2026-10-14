import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Sentinel value for "no reference selected" (Radix Select can't use an empty-string value). */
export const NO_REFERENCE = '__none__'

/**
 * Shared label + error wrapper for the verify sub-steps (extracted verbatim from the old
 * StepVerifyDetails so every sub-step renders identical field markup).
 */
export function Field({ label, id, error, required, children }) {
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

/** A dealer-reference dropdown (shared by the seller and buyer reference fields). */
export function RefSelect({ id, label, value, onValueChange, references }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || NO_REFERENCE}
        onValueChange={(val) => onValueChange(val === NO_REFERENCE ? '' : val)}
      >
        <SelectTrigger id={id}>
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
  )
}
