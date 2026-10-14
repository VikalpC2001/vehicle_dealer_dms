import { useId, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * A confirmation modal that requires the user to type an exact word (default `"DELETE"`,
 * case-sensitive) before the confirm button enables — a guardrail for destructive/irreversible
 * actions. Mirrors `ConfirmModal`'s props and styling, adding the typed-to-confirm Input. The typed
 * value resets whenever the dialog opens (the body remounts with `DialogContent`).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} [props.confirmWord='DELETE'] - Exact text the user must type (case-sensitive).
 * @param {string} [props.confirmLabel='Delete']
 * @param {'default'|'destructive'} [props.variant='destructive']
 * @param {() => void} props.onConfirm
 * @param {boolean} [props.loading]
 */
export function TypeConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmWord = 'DELETE',
  confirmLabel = 'Delete',
  variant = 'destructive',
  onConfirm,
  loading,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Rendered only while open (DialogContent unmounts on close), so the typed value always
            starts empty on the next open — no reset effect needed. */}
        <TypeConfirmBody
          confirmWord={confirmWord}
          confirmLabel={confirmLabel}
          variant={variant}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  )
}

function TypeConfirmBody({ confirmWord, confirmLabel, variant, onCancel, onConfirm, loading }) {
  const [value, setValue] = useState('')
  const inputId = useId()
  const confirmed = value === confirmWord

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={inputId}>
          Type <span className="font-semibold text-foreground">{confirmWord}</span> to confirm
        </Label>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={confirmWord}
          autoComplete="off"
          disabled={loading}
        />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onClick={onConfirm}
          disabled={loading || !confirmed}
        >
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  )
}
