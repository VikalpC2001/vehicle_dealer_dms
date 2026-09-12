import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Mail, Phone, UserPlus, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/common/SearchInput'
import { dealerAgentService } from '@/services/dealerAgentService'
import { useDebounce } from '@/hooks/useDebounce'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/**
 * Dealer: find an existing agent by email / phone / name and grant them access. When the search
 * yields no match, offers an "Invite new agent" CTA (wired in Phase C via `onInvite`).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {boolean} props.hasFreeSlot   Whether the dealer can consume another active-agent slot.
 * @param {(prefill?: { q?: string }) => void} [props.onInvite]  Opens the invite flow (Phase C).
 */
export function AddAgentDialog({ open, onOpenChange, hasFreeSlot, onInvite }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query.trim(), 300)
  const canSearch = debounced.length >= 2

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['dealer-agents', 'search', debounced],
    queryFn: () => dealerAgentService.search(debounced),
    enabled: open && canSearch,
  })

  const close = (o) => {
    if (!o) setQuery('')
    onOpenChange(o)
  }

  const grantMutation = useMutation({
    mutationFn: (agentId) => dealerAgentService.grant(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-agents'] })
      toast({ title: 'Agent added', description: 'You can now assign processes to this agent.', variant: 'success' })
      close(false)
    },
    onError: (err) =>
      toast({ title: 'Could not add agent', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const grantingId = grantMutation.isPending ? grantMutation.variables : null

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Agent</DialogTitle>
          <DialogDescription>
            Search for an agent by email, phone, or name — then grant them access so you can assign
            vehicle processes.
          </DialogDescription>
        </DialogHeader>

        {!hasFreeSlot && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              Agent limit reached. Ask an admin to raise your agent slots before adding another
              active agent.
            </span>
          </div>
        )}

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search email, phone, or name…"
        />

        <div className="min-h-[6rem] space-y-1">
          {!canSearch ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          ) : isFetching ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          ) : results.length === 0 ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">No agent found for “{debounced}”.</p>
              {onInvite && (
                <Button variant="outline" onClick={() => onInvite({ q: debounced })}>
                  <UserPlus className="mr-2 h-4 w-4" /> Invite a new agent
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {results.map((agent) => (
                <div key={agent.agentId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {agent.displayName || agent.firmName}
                      {agent.agentName ? (
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          {agent.agentName}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {agent.emailId && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" /> {agent.emailId}
                        </span>
                      )}
                      {agent.mobileNo && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {agent.mobileNo}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!hasFreeSlot || grantMutation.isPending}
                    onClick={() => grantMutation.mutate(agent.agentId)}
                  >
                    {grantingId === agent.agentId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…
                      </>
                    ) : (
                      'Grant'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {onInvite && results.length > 0 && (
          <div className="border-t border-border pt-3 text-center text-sm text-muted-foreground">
            Can’t find them?{' '}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => onInvite({ q: debounced })}
            >
              Invite a new agent
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
