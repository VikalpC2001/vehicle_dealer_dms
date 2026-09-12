import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dealerService, getDealerId } from '@/services/dealerService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/**
 * Super-admin: set a dealer's active-agent slot limit (the manual "addon" — a future self-serve
 * purchase will call the same endpoint). Calls PATCH /dealers/:id/agent-slots.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object|null} props.dealer
 */
export function AgentSlotsDialog({ open, onOpenChange, dealer }) {
  const queryClient = useQueryClient()
  // `null` = show the dealer's current maxAgents; a string = the admin's in-progress edit.
  const [value, setValue] = useState(null)
  const shown = value ?? String(dealer?.maxAgents ?? 2)

  const close = (o) => {
    if (!o) setValue(null)
    onOpenChange(o)
  }

  const mutation = useMutation({
    mutationFn: () => dealerService.raiseAgentSlots(getDealerId(dealer), { maxAgents: Number(shown) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['dealers'] })
      toast({
        title: 'Agent slots updated',
        description: `${dealer?.firmName}: ${res?.maxAgents} active-agent slots.`,
        variant: 'success',
      })
      close(false)
    },
    onError: (err) =>
      toast({ title: 'Could not update slots', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const invalid = !/^\d+$/.test(shown.trim())

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent slots — {dealer?.firmName}</DialogTitle>
          <DialogDescription>
            The maximum number of active agents this dealer may have. This is the manual addon grant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="maxAgents">Active-agent limit</Label>
          <Input
            id="maxAgents"
            type="number"
            min={0}
            value={shown}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => close(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={invalid || mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
