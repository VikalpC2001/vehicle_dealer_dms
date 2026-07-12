import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { agentStatusService } from '@/services/agentStatusService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

let tmpId = 0

/**
 * Manage the agent's custom RTO statuses (name, colour, order). Edits are staged
 * locally and persisted via the sync endpoint (create/update/delete + order by array).
 */
export function AgentStatusesPanel() {
  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['agent-statuses'],
    queryFn: () => agentStatusService.getAll(),
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">RTO Statuses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    )
  }

  // Remount the editor when the persisted status set/order changes so its local
  // edit state re-seeds from the server (avoids setState-in-effect).
  const seedKey = statuses.map((s) => s.statusId).join(',') || 'empty'
  return <StatusesEditor key={seedKey} initial={statuses} />
}

function StatusesEditor({ initial }) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState(() =>
    initial.map((s) => ({
      _key: s.statusId,
      statusId: s.statusId,
      statusName: s.statusName,
      colour: s.colour || '#3b82f6',
    }))
  )

  const saveMutation = useMutation({
    mutationFn: () =>
      agentStatusService.sync(
        rows.map((r) => ({
          ...(r.statusId ? { statusId: r.statusId } : {}),
          statusName: r.statusName.trim(),
          colour: r.colour,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-statuses'] })
      toast({ title: 'Statuses saved', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not save statuses', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r._key !== key))
  const addRow = () => setRows((rs) => [...rs, { _key: `new-${tmpId++}`, statusName: '', colour: '#3b82f6' }])
  const move = (i, dir) =>
    setRows((rs) => {
      const j = i + dir
      if (j < 0 || j >= rs.length) return rs
      const copy = [...rs]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  const canSave = rows.length > 0 && rows.every((r) => r.statusName.trim() && r.colour)

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">RTO Statuses</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize the statuses and their order. Used on assignments you work on.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="mr-1.5 h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No statuses yet. Add one to get started.</p>
        ) : (
          rows.map((r, i) => (
            <div key={r._key} className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(r.colour) ? r.colour : '#3b82f6'}
                onChange={(e) => update(r._key, { colour: e.target.value })}
                className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-card"
                aria-label="Status colour"
              />
              <Input
                value={r.statusName}
                onChange={(e) => update(r._key, { statusName: e.target.value })}
                placeholder="Status name"
              />
              <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => removeRow(r._key)} aria-label="Delete status">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save changes</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
