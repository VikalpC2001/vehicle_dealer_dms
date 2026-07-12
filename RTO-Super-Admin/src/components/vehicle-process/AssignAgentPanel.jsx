import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { processAssignmentService } from '@/services/processAssignmentService'
import { dealerAgentService } from '@/services/dealerAgentService'
import { rtoServiceService } from '@/services/rtoServiceService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

const EMPTY = { agentId: '', serviceId: '', note: '' }

/**
 * Assign a vehicle process to a granted agent for an RTO service. Shows current
 * assignments with the agent's working status and lets the dealer cancel them.
 *
 * @param {object} props
 * @param {string} props.processId
 */
export function AssignAgentPanel({ processId }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [cancelTarget, setCancelTarget] = useState(null)

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['process-assignments', processId],
    queryFn: () => processAssignmentService.listForProcess(processId),
    enabled: Boolean(processId),
  })

  const { data: dealerAgents } = useQuery({
    queryKey: ['dealer-agents'],
    queryFn: () => dealerAgentService.getAll(),
    enabled: open,
  })
  const agents = dealerAgents?.items ?? []

  const { data: services = [] } = useQuery({
    queryKey: ['rto-services-all'],
    queryFn: () => rtoServiceService.listAll(),
    enabled: open,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['process-assignments', processId] })

  const createMutation = useMutation({
    mutationFn: () =>
      processAssignmentService.create({
        processId,
        agentId: form.agentId,
        serviceId: form.serviceId,
        note: form.note || undefined,
      }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Assigned to agent', description: 'The agent can now work this process.', variant: 'success' })
      setOpen(false)
      setForm(EMPTY)
    },
    onError: (err) => toast({ title: 'Could not assign', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const cancelMutation = useMutation({
    mutationFn: (assignmentId) => processAssignmentService.remove(assignmentId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Assignment cancelled', variant: 'success' })
      setCancelTarget(null)
    },
    onError: (err) => toast({ title: 'Could not cancel', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const canSave = form.agentId && form.serviceId

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          Assign to Agent
        </CardTitle>
        <Button size="sm" onClick={() => { setForm(EMPTY); setOpen(true) }}>
          Assign
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not assigned to any agent yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {assignments.map((assignment) => (
              <div key={assignment.assignmentId} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{assignment.agent?.firmName || assignment.agent?.agentName}</p>
                    {assignment.service && (
                      <Badge variant="outline">
                        {assignment.service.shortName || assignment.service.serviceName}
                      </Badge>
                    )}
                    {assignment.agentStatus && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium"
                        style={
                          assignment.agentStatus.colour
                            ? { borderColor: assignment.agentStatus.colour, color: assignment.agentStatus.colour }
                            : undefined
                        }
                      >
                        {assignment.agentStatus.colour && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: assignment.agentStatus.colour }}
                          />
                        )}
                        {assignment.agentStatus.statusName}
                      </span>
                    )}
                  </div>
                  {assignment.agent?.agentName && assignment.agent?.firmName && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{assignment.agent.agentName}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCancelTarget(assignment)}
                  aria-label="Cancel assignment"
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Agent</DialogTitle>
            <DialogDescription>Pick a granted agent and the RTO service to assign for this process.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave) createMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={form.agentId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, agentId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((item) => (
                    <SelectItem key={item.agent?.agentId} value={item.agent?.agentId}>
                      {item.agent?.displayName || item.agent?.firmName}
                      {item.agent?.agentName ? ` — ${item.agent.agentName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agents.length === 0 && (
                <p className="text-xs text-muted-foreground">No granted agents. Add one from the My Agents page first.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>RTO Service</Label>
              <Select value={form.serviceId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, serviceId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.serviceId} value={service.serviceId}>
                      {service.serviceName}
                      {service.shortName ? ` (${service.shortName})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignNote">Note (optional)</Label>
              <Input
                id="assignNote"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Any instructions for the agent"
              />
            </div>
            <Button type="submit" className="w-full" disabled={!canSave || createMutation.isPending}>
              {createMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning…</>
              ) : (
                'Assign'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(cancelTarget)}
        onOpenChange={() => setCancelTarget(null)}
        title="Cancel assignment"
        description={`Cancel the assignment to ${cancelTarget?.agent?.firmName || cancelTarget?.agent?.agentName || 'this agent'}? It will be kept for history.`}
        confirmLabel="Cancel assignment"
        variant="destructive"
        onConfirm={() => cancelMutation.mutate(cancelTarget?.assignmentId)}
        loading={cancelMutation.isPending}
      />
    </Card>
  )
}
