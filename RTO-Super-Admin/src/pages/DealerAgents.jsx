import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Trash2, Mail, Phone, Users, Clock, Send, X, ArrowRightLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { AddAgentDialog } from '@/components/dealers/AddAgentDialog'
import { InviteAgentDialog } from '@/components/dealers/InviteAgentDialog'
import { SwitchAgentDialog } from '@/components/dealers/SwitchAgentDialog'
import { dealerAgentService } from '@/services/dealerAgentService'
import { agentInvitationService } from '@/services/agentInvitationService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

export default function DealerAgents() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [switchTarget, setSwitchTarget] = useState(null)
  const [revokeTarget, setRevokeTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dealer-agents'],
    queryFn: () => dealerAgentService.getAll(),
  })

  const { data: invitations = [] } = useQuery({
    queryKey: ['agent-invitations'],
    queryFn: () => agentInvitationService.list(),
  })

  const items = data?.items ?? []
  const capInfo = data?.capInfo ?? null
  const hasFreeSlot = capInfo ? capInfo.hasFreeSlot ?? capInfo.used < capInfo.maxAgents : true

  const openInvite = (prefill) => {
    const q = prefill?.q
    setInviteEmail(q && q.includes('@') ? q : '')
    setAddOpen(false)
    setInviteOpen(true)
  }

  const revokeMutation = useMutation({
    mutationFn: (dealerAgentId) => dealerAgentService.revoke(dealerAgentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-agents'] })
      toast({ title: 'Agent removed', variant: 'success' })
      setRevokeTarget(null)
    },
    onError: (err) => toast({ title: 'Could not remove agent', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const resendMutation = useMutation({
    mutationFn: (id) => agentInvitationService.resend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-invitations'] })
      toast({ title: 'Invitation re-sent', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not resend', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => agentInvitationService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-invitations'] })
      toast({ title: 'Invitation cancelled', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not cancel', description: getErrorMessage(err), variant: 'destructive' }),
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
              <Badge variant={hasFreeSlot ? 'secondary' : 'warning'}>{capInfo.used} / {capInfo.maxAgents} agents</Badge>
              {capInfo.overCap && <Badge variant="destructive">Over cap</Badge>}
            </>
          )}
          <Button onClick={() => setAddOpen(true)}>
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
                <div key={item.dealerAgentId} className="flex items-center justify-between gap-2 py-1">
                  {/* The row (everything but the two buttons) opens the work assigned to this agent. */}
                  <Link
                    to={`/dealer/agents/${item.agentId ?? item.agent?.agentId}`}
                    title="View assigned work"
                    className="group -mx-2 flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
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
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      <span className="hidden sm:inline">View work</span>
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </Link>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSwitchTarget(item)}
                      aria-label="Switch or deactivate agent"
                      title="Switch / deactivate"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setRevokeTarget(item)} aria-label="Revoke agent">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {invitations.map((inv) => (
                <div key={inv.invitationId} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{inv.agentName}</p>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {inv.emailId}</span>
                      {inv.mobileNo && (
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {inv.mobileNo}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => resendMutation.mutate(inv.invitationId)}
                      disabled={resendMutation.isPending}
                      aria-label="Resend invitation"
                      title="Resend"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancelMutation.mutate(inv.invitationId)}
                      disabled={cancelMutation.isPending}
                      aria-label="Cancel invitation"
                      title="Cancel"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AddAgentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        hasFreeSlot={hasFreeSlot}
        onInvite={openInvite}
      />

      <InviteAgentDialog open={inviteOpen} onOpenChange={setInviteOpen} defaultEmail={inviteEmail} />

      <SwitchAgentDialog
        open={!!switchTarget}
        onOpenChange={(o) => !o && setSwitchTarget(null)}
        grant={switchTarget}
      />

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
