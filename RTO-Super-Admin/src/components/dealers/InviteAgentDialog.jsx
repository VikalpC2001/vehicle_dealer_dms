import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
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
import { agentInvitationService } from '@/services/agentInvitationService'
import { getErrorMessage, parseValidationErrors } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

const inviteSchema = z.object({
  agentName: z.string().min(2, 'Agent name is required'),
  emailId: z.string().email('Enter a valid email'),
  mobileNo: z.string().optional(),
})

/**
 * Dealer: invite a brand-new agent by email. On success the backend emails a single-use onboarding
 * link; the pending invitation appears in the dealer's list until accepted/cancelled.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} [props.defaultEmail]  Prefill (e.g. the search term that yielded no match).
 */
export function InviteAgentDialog({ open, onOpenChange, defaultEmail = '' }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(inviteSchema),
    values: { agentName: '', emailId: defaultEmail, mobileNo: '' },
  })

  const close = (o) => {
    if (!o) reset({ agentName: '', emailId: '', mobileNo: '' })
    onOpenChange(o)
  }

  const mutation = useMutation({
    mutationFn: (payload) => agentInvitationService.create(payload),
    onSuccess: (invitation) => {
      queryClient.invalidateQueries({ queryKey: ['agent-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['dealer-agents'] })
      toast({
        title: 'Invitation sent',
        description: `We've emailed an onboarding link to ${invitation?.emailId}.`,
        variant: 'success',
      })
      close(false)
    },
    onError: (err) => {
      const fieldErrors = parseValidationErrors(err)
      const keys = Object.keys(fieldErrors)
      if (keys.length) {
        keys.forEach((field) => setError(field, { message: fieldErrors[field] }))
      } else {
        toast({ title: 'Could not send invitation', description: getErrorMessage(err), variant: 'destructive' })
      }
    },
  })

  const onSubmit = (values) => {
    const payload = { agentName: values.agentName.trim(), emailId: values.emailId.trim() }
    if (values.mobileNo?.trim()) payload.mobileNo = values.mobileNo.trim()
    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a new agent</DialogTitle>
          <DialogDescription>
            Send an email invitation. The agent completes their own onboarding, and (if you have a
            free slot) they're added to your agents automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Agent name</Label>
            <Input placeholder="e.g. Ramesh Kumar" {...register('agentName')} />
            {errors.agentName && <p className="text-sm text-destructive">{errors.agentName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="agent@example.com" {...register('emailId')} />
            {errors.emailId && <p className="text-sm text-destructive">{errors.emailId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Mobile number (optional)</Label>
            <Input placeholder="98765 43210" {...register('mobileNo')} />
            {errors.mobileNo && <p className="text-sm text-destructive">{errors.mobileNo.message}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" /> Send invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
