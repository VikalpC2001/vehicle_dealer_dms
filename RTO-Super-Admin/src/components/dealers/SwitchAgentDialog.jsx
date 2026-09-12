import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ArrowRightLeft, ClipboardList, Wallet, X, Search as SearchIcon } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/common/SearchInput'
import { dealerAgentService } from '@/services/dealerAgentService'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCurrency, cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/**
 * Dealer: switch off (or deactivate) an active agent. Shows the agent's OPEN assignments (which
 * will be auto-completed) and their ledger balance, lets the dealer settle or keep the balance, and
 * optionally pick a replacement agent — all applied atomically by POST /dealer-agents/switch.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object|null} props.grant  The active dealer-agent grant row (with nested `agent`).
 */
export function SwitchAgentDialog({ open, onOpenChange, grant }) {
  const queryClient = useQueryClient()
  const oldAgentId = grant?.agent?.agentId
  const oldAgentName = grant?.agent?.displayName || grant?.agent?.firmName || 'this agent'

  const [settleDecision, setSettleDecision] = useState('KEEP')
  const [settleAmount, setSettleAmount] = useState('')
  const [replacement, setReplacement] = useState(null)
  const [replaceQuery, setReplaceQuery] = useState('')
  const debouncedReplace = useDebounce(replaceQuery.trim(), 300)

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['dealer-agents', 'switch-preview', oldAgentId],
    queryFn: () => dealerAgentService.switchPreview(oldAgentId),
    enabled: open && !!oldAgentId,
  })

  const canSearchReplace = debouncedReplace.length >= 2
  const { data: replaceResults = [], isFetching: replaceSearching } = useQuery({
    queryKey: ['dealer-agents', 'search', debouncedReplace],
    queryFn: () => dealerAgentService.search(debouncedReplace),
    enabled: open && !replacement && canSearchReplace,
  })

  const reset = () => {
    setSettleDecision('KEEP')
    setSettleAmount('')
    setReplacement(null)
    setReplaceQuery('')
  }
  const close = (o) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const balance = Number(preview?.balance ?? 0)
  const hasBalance = preview?.hasBalance ?? balance !== 0

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        oldAgentId,
        settleDecision: hasBalance ? settleDecision : 'KEEP',
      }
      if (replacement?.agentId) payload.newAgentId = replacement.agentId
      if (hasBalance && settleDecision === 'SETTLE' && settleAmount.trim()) {
        payload.settleAmount = Number(settleAmount)
      }
      return dealerAgentService.switch(payload)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['dealer-agents'] })
      queryClient.invalidateQueries({ queryKey: ['khata'] })
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] })
      const parts = []
      if (res?.completedCount) parts.push(`${res.completedCount} task(s) completed`)
      if (res?.settledEntry) parts.push('balance settled')
      if (res?.newGrant) parts.push('replacement activated')
      toast({
        title: replacement ? 'Agent switched' : 'Agent deactivated',
        description: parts.length ? parts.join(', ') + '.' : undefined,
        variant: 'success',
      })
      close(false)
    },
    onError: (err) =>
      toast({ title: 'Could not switch agent', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const amountInvalid =
    hasBalance &&
    settleDecision === 'SETTLE' &&
    settleAmount.trim() !== '' &&
    (!/^\d+(\.\d{1,2})?$/.test(settleAmount.trim()) || Number(settleAmount) <= 0)

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Switch / deactivate — {oldAgentName}</DialogTitle>
          <DialogDescription>
            Review {oldAgentName}'s open work and balance, then deactivate them or switch to another
            agent. Nothing is deleted — history is preserved.
          </DialogDescription>
        </DialogHeader>

        {previewLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading current work…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Open assignments */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Active tasks
                <Badge variant="secondary">{preview?.openAssignmentCount ?? 0}</Badge>
              </div>
              {preview?.openAssignmentCount ? (
                <>
                  <div className="divide-y divide-border rounded-md border border-border">
                    {preview.openAssignments.map((a) => (
                      <div key={a.assignmentId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="truncate">
                          {a.process?.vehicle?.registrationNumber || 'Vehicle'}
                          <span className="ml-2 text-muted-foreground">{a.service?.shortName || a.service?.serviceName}</span>
                        </span>
                        <Badge variant="outline">{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These will be marked <span className="font-medium">complete</span> when you switch.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No open tasks with this agent.</p>
              )}
            </section>

            {/* Ledger balance + settle decision */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Ledger balance
              </div>
              {hasBalance ? (
                <>
                  <p className="text-sm">
                    Pending balance:{' '}
                    <span className={cn('font-semibold', balance > 0 ? 'text-warning' : 'text-success')}>
                      {formatCurrency(Math.abs(balance))}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {balance > 0 ? '(you owe the agent)' : '(agent owes you)'}
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettleDecision('SETTLE')}
                      className={cn(
                        'rounded-md border p-3 text-left text-sm transition',
                        settleDecision === 'SETTLE' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                      )}
                    >
                      <span className="font-medium">Settle now</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Posts a balancing ledger entry (history preserved).
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettleDecision('KEEP')}
                      className={cn(
                        'rounded-md border p-3 text-left text-sm transition',
                        settleDecision === 'KEEP' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                      )}
                    >
                      <span className="font-medium">Keep open</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Leave the balance on the ledger to settle later.
                      </span>
                    </button>
                  </div>
                  {settleDecision === 'SETTLE' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="settleAmount" className="text-xs">
                        Partial amount (optional — blank settles the full balance)
                      </Label>
                      <Input
                        id="settleAmount"
                        inputMode="decimal"
                        placeholder={String(Math.abs(balance))}
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                      />
                      {amountInvalid && <p className="text-xs text-destructive">Enter a valid amount.</p>}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Balance is settled — nothing pending.</p>
              )}
            </section>

            {/* Optional replacement */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                Switch to a new agent (optional)
              </div>
              {replacement ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <span className="truncate text-sm">
                    {replacement.displayName || replacement.firmName}
                    {replacement.emailId ? (
                      <span className="ml-2 text-xs text-muted-foreground">{replacement.emailId}</span>
                    ) : null}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setReplacement(null)} aria-label="Clear replacement">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <SearchInput value={replaceQuery} onChange={setReplaceQuery} placeholder="Search agent to switch to…" />
                  {canSearchReplace && (
                    <div className="rounded-md border border-border">
                      {replaceSearching ? (
                        <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                        </p>
                      ) : replaceResults.filter((r) => r.agentId !== oldAgentId).length === 0 ? (
                        <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                          <SearchIcon className="h-4 w-4" /> No agents found.
                        </p>
                      ) : (
                        <div className="divide-y divide-border">
                          {replaceResults
                            .filter((r) => r.agentId !== oldAgentId)
                            .map((r) => (
                              <button
                                key={r.agentId}
                                type="button"
                                onClick={() => setReplacement(r)}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                              >
                                <span className="truncate">
                                  {r.displayName || r.firmName}
                                  {r.emailId ? <span className="ml-2 text-xs text-muted-foreground">{r.emailId}</span> : null}
                                </span>
                                <span className="text-xs font-medium text-primary">Select</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Leave empty to just deactivate {oldAgentName}.
                  </p>
                </>
              )}
            </section>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => close(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={previewLoading || amountInvalid || mutation.isPending}
            variant={replacement ? 'default' : 'destructive'}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying…
              </>
            ) : replacement ? (
              'Switch agent'
            ) : (
              'Deactivate agent'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
