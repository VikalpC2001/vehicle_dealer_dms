import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, X, Loader2, Pencil, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { processAssignmentService } from '@/services/processAssignmentService'
import { dealerAgentService } from '@/services/dealerAgentService'
import { rtoServiceService } from '@/services/rtoServiceService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

const EMPTY = { agentId: '', serviceIds: [], note: '', cost: '', costDate: '', costNote: '' }
const MAX_AMOUNT = 999999999999.99

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const formatMoney = (n) => inr.format(Number(n ?? 0))

/** ISO string → the value a `datetime-local` input expects (local YYYY-MM-DDTHH:mm). */
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '')
const isValidAmount = (s) =>
  /^\d+(\.\d{1,2})?$/.test(String(s).trim()) && Number(s) > 0 && Number(s) <= MAX_AMOUNT

/**
 * Assign a vehicle process to a granted agent for an RTO service. Optionally records a cost
 * (money owed to the agent) in the khata ledger. Shows current assignments with the agent's
 * working status + any recorded cost, and lets the dealer edit the cost or cancel the assignment.
 *
 * @param {object} props
 * @param {string} props.processId
 */
export function AssignAgentPanel({ processId }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [costTarget, setCostTarget] = useState(null)
  const [costForm, setCostForm] = useState({ cost: '', costDate: '', costNote: '' })

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

  // A cost change touches both the assignment view and the ledger.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['process-assignments', processId] })
    queryClient.invalidateQueries({ queryKey: ['khata-accounts'] })
    queryClient.invalidateQueries({ queryKey: ['khata-statement'] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      processAssignmentService.create({
        processId,
        agentId: form.agentId,
        serviceIds: form.serviceIds,
        note: form.note || undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        costDate: form.costDate ? new Date(form.costDate).toISOString() : undefined,
        costNote: form.costNote || undefined,
      }),
    onSuccess: (result) => {
      invalidate()
      const createdCount = result?.created?.length ?? 0
      const skippedCount = result?.skippedServiceIds?.length ?? 0
      toast({
        title: 'Assigned to agent',
        description:
          `${createdCount} service${createdCount === 1 ? '' : 's'} assigned` +
          (skippedCount ? ` · ${skippedCount} already assigned` : ''),
        variant: 'success',
      })
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

  const costMutation = useMutation({
    mutationFn: (payload) => processAssignmentService.updateCost(costTarget.assignmentId, payload),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Cost updated', variant: 'success' })
      setCostTarget(null)
    },
    onError: (err) => toast({ title: 'Could not update cost', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const openCost = (assignment) => {
    setCostForm({
      cost: assignment.cost ? String(assignment.cost.amount) : '',
      costDate: toLocalInput(assignment.cost?.entryDate),
      costNote: assignment.cost?.description ?? '',
    })
    setCostTarget(assignment)
  }

  const saveCost = () => {
    // Only send the fields the dealer actually changed, so the backend can tell "keep amount"
    // (omit `cost`) from "change" (send number) from "remove" (send null). An amount change posts
    // a ledger reversal + new entry; a date/note-only change edits the entry in place.
    const c = costTarget.cost
    const origAmount = c ? String(c.amount) : ''
    const origDate = toLocalInput(c?.entryDate)
    const origNote = c?.description ?? ''
    const payload = {}
    if (costForm.cost !== origAmount) payload.cost = costForm.cost ? Number(costForm.cost) : null
    if (costForm.costDate && costForm.costDate !== origDate) {
      payload.costDate = new Date(costForm.costDate).toISOString()
    }
    if (costForm.costNote !== origNote) payload.costNote = costForm.costNote || undefined
    costMutation.mutate(payload)
  }

  const canSave = form.agentId && form.serviceIds.length > 0
  const assignCostInvalid = form.cost !== '' && !isValidAmount(form.cost)
  const editCostInvalid = costForm.cost !== '' && !isValidAmount(costForm.cost)

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
                    {assignment.cost && (
                      <Badge variant="secondary" className="gap-1">
                        <Wallet className="h-3 w-3" />
                        {formatMoney(assignment.cost.amount)}
                        {assignment.cost.entryDate ? ` · ${formatDate(assignment.cost.entryDate)}` : ''}
                      </Badge>
                    )}
                  </div>
                  {assignment.agent?.agentName && assignment.agent?.firmName && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{assignment.agent.agentName}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openCost(assignment)}
                    aria-label={assignment.cost ? 'Edit agent cost' : 'Add agent cost'}
                    title={assignment.cost ? 'Edit cost' : 'Add cost'}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCancelTarget(assignment)}
                    aria-label="Cancel assignment"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Assign dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Agent</DialogTitle>
            <DialogDescription>Pick a granted agent and one or more RTO services to assign for this process.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave && !assignCostInvalid) createMutation.mutate()
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
              <Label>RTO Services</Label>
              <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border p-2">
                {services.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">No RTO services available.</p>
                ) : (
                  services.map((service) => {
                    const checked = form.serviceIds.includes(service.serviceId)
                    return (
                      <label
                        key={service.serviceId}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setForm((f) => ({
                              ...f,
                              serviceIds: checked
                                ? f.serviceIds.filter((id) => id !== service.serviceId)
                                : [...f.serviceIds, service.serviceId],
                            }))
                          }
                        />
                        <span className="text-sm">
                          {service.serviceName}
                          {service.shortName ? ` (${service.shortName})` : ''}
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
              {form.serviceIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{form.serviceIds.length} selected</p>
              )}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assignCost">Amount per service (₹) (optional)</Label>
                <Input
                  id="assignCost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignCostDate">Cost date (optional)</Label>
                <Input
                  id="assignCostDate"
                  type="datetime-local"
                  value={form.costDate}
                  onChange={(e) => setForm((f) => ({ ...f, costDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignCostNote">Cost note (optional)</Label>
              <Input
                id="assignCostNote"
                value={form.costNote}
                onChange={(e) => setForm((f) => ({ ...f, costNote: e.target.value }))}
                placeholder="e.g. Name-transfer fee"
              />
            </div>
            {assignCostInvalid ? (
              <p className="text-xs text-destructive">Enter a valid amount (up to 2 decimals).</p>
            ) : (
              <p className="text-xs text-muted-foreground">Applied to each selected service and recorded in the ledger as money you owe this agent.</p>
            )}
            <Button type="submit" className="w-full" disabled={!canSave || assignCostInvalid || createMutation.isPending}>
              {createMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning…</>
              ) : (
                'Assign'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit-cost dialog */}
      <Dialog open={Boolean(costTarget)} onOpenChange={(o) => !o && setCostTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{costTarget?.cost ? 'Edit' : 'Add'} agent cost</DialogTitle>
            <DialogDescription>
              Money you owe {costTarget?.agent?.firmName || costTarget?.agent?.agentName || 'this agent'} for this job.
              Changing the amount posts a correction to the ledger — history is preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editCost">Amount (₹)</Label>
                <Input
                  id="editCost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={costForm.cost}
                  onChange={(e) => setCostForm((f) => ({ ...f, cost: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCostDate">Date</Label>
                <Input
                  id="editCostDate"
                  type="datetime-local"
                  value={costForm.costDate}
                  onChange={(e) => setCostForm((f) => ({ ...f, costDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCostNote">Note</Label>
              <Input
                id="editCostNote"
                value={costForm.costNote}
                onChange={(e) => setCostForm((f) => ({ ...f, costNote: e.target.value }))}
                placeholder="e.g. Name-transfer fee"
              />
            </div>
            {editCostInvalid && <p className="text-xs text-destructive">Enter a valid amount (up to 2 decimals).</p>}
            {costForm.cost === '' && (
              <p className="text-xs text-muted-foreground">Leave the amount empty and save to remove the cost.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCostTarget(null)} disabled={costMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={saveCost} disabled={editCostInvalid || costMutation.isPending}>
              {costMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
              ) : costForm.cost === '' ? (
                'Remove cost'
              ) : (
                'Save cost'
              )}
            </Button>
          </DialogFooter>
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
