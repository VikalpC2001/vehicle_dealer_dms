import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Trash2, Loader2, Mail, Phone, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { dealerAgentService } from '@/services/dealerAgentService'
import { agentService, getAgentId } from '@/services/agentService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

export default function DealerAgents() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [revokeTarget, setRevokeTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dealer-agents'],
    queryFn: () => dealerAgentService.getAll(),
  })

  const items = data?.items ?? []
  const capInfo = data?.capInfo ?? null

  const { data: allAgents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents-all'],
    queryFn: () => agentService.listAll(),
    enabled: open,
  })

  const grantedIds = useMemo(
    () => new Set((data?.items ?? []).map((item) => item.agent?.agentId).filter(Boolean)),
    [data]
  )
  const availableAgents = useMemo(
    () => allAgents.filter((agent) => !grantedIds.has(getAgentId(agent))),
    [allAgents, grantedIds]
  )

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dealer-agents'] })

  const grantMutation = useMutation({
    mutationFn: (agentId) => dealerAgentService.grant(agentId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Agent added', description: 'You can now assign processes to this agent.', variant: 'success' })
      setOpen(false)
      setSelectedAgentId('')
    },
    onError: (err) => toast({ title: 'Could not add agent', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const revokeMutation = useMutation({
    mutationFn: (dealerAgentId) => dealerAgentService.revoke(dealerAgentId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Agent removed', variant: 'success' })
      setRevokeTarget(null)
    },
    onError: (err) => toast({ title: 'Could not remove agent', description: getErrorMessage(err), variant: 'destructive' }),
  })

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">My Agents</h1>
          <p className="text-muted-foreground mt-1">Grant RTO agents access so you can assign vehicle processes to them.</p>
        </div>
        <div className="flex items-center gap-2">
          {capInfo && (
            <>
              <Badge variant="secondary">{capInfo.used} / {capInfo.maxAgents} agents</Badge>
              {capInfo.overCap && <Badge variant="destructive">Over cap</Badge>}
            </>
          )}
          <Button onClick={() => { setSelectedAgentId(''); setOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" /> Add Agent
          </Button>
        </div>
      </motion.div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Granted Agents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents yet. Add an agent to start assigning processes.</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.dealerAgentId} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.agent?.displayName || item.agent?.firmName}</p>
                      {item.agent?.agentName && (
                        <span className="text-sm text-muted-foreground">{item.agent.agentName}</span>
                      )}
                      {item.status && <Badge variant="success">{item.status}</Badge>}
                      {item.source && <Badge variant="outline">{item.source}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.agent?.emailId && (
                        <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {item.agent.emailId}</span>
                      )}
                      {item.agent?.mobileNo && (
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {item.agent.mobileNo}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setRevokeTarget(item)} aria-label="Revoke agent">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Agent</DialogTitle>
            <DialogDescription>Grant an RTO agent access so you can assign them vehicle processes.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (selectedAgentId) grantMutation.mutate(selectedAgentId)
            }}
            className="space-y-4"
          >
            <Select value={selectedAgentId || undefined} onValueChange={setSelectedAgentId} disabled={agentsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={agentsLoading ? 'Loading agents…' : 'Select an agent'} />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.map((agent) => (
                  <SelectItem key={getAgentId(agent)} value={getAgentId(agent)}>
                    {agent.displayName || agent.firmName}
                    {agent.agentName ? ` — ${agent.agentName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!agentsLoading && availableAgents.length === 0 && (
              <p className="text-sm text-muted-foreground">No more agents available to add.</p>
            )}
            <Button type="submit" className="w-full" disabled={!selectedAgentId || grantMutation.isPending}>
              {grantMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…</>
              ) : (
                'Add agent'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(revokeTarget)}
        onOpenChange={() => setRevokeTarget(null)}
        title="Remove agent"
        description={`Remove ${revokeTarget?.agent?.displayName || revokeTarget?.agent?.firmName || 'this agent'}? You will no longer be able to assign them new processes.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => revokeMutation.mutate(revokeTarget?.dealerAgentId)}
        loading={revokeMutation.isPending}
      />
    </div>
  )
}
