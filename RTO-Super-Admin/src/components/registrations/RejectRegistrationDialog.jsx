import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Confirms rejecting a registration with an optional reason (emailed + shown on the applicant's
 * pending screen). Parent should remount via `key` so the reason resets per request.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object|null} props.request
 * @param {(reason: string|undefined) => void} props.onConfirm
 * @param {boolean} [props.loading]
 */
export function RejectRegistrationDialog({ open, onOpenChange, request, onConfirm, loading }) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject registration</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{request?.firmName}</span> will be blocked from the app and emailed a
            decline. The reason is shown on their pending screen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Reason (optional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Could not verify your business details"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason.trim() || undefined)} disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting…</> : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
