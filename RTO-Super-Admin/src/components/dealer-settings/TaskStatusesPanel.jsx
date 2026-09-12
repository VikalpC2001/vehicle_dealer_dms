import { useId, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dealerTaskStatusService } from '@/services/dealerTaskStatusService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

let tmpId = 0

/** Common CSS colour names → hex, so legacy/seed named colours (e.g. 'blue', 'Yellow') display in the picker. */
const NAMED_HEX = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  indigo: '#6366f1',
  gray: '#6b7280',
  grey: '#6b7280',
  black: '#111827',
  white: '#f9fafb',
}

/**
 * Coerce a stored colour (hex OR a CSS name like the seed's 'blue'/'Yellow'/'green') into a
 * `#RRGGBB` value the native `<input type="color">` can display — otherwise named colours all
 * collapse to the fallback and the picker looks broken. Saving then persists proper hex.
 */
function toHexColour(colour) {
  if (typeof colour === 'string') {
    if (/^#[0-9a-fA-F]{6}$/.test(colour)) return colour
    const named = NAMED_HEX[colour.trim().toLowerCase()]
    if (named) return named
  }
  return '#3b82f6'
}

/**
 * Manage the dealer's task-board columns (name, colour, order, isDone). Edits are staged locally
 * and persisted via the sync endpoint (create/update/delete + order by array).
 */
export function TaskStatusesPanel() {
  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['dealer-task-statuses'],
    queryFn: () => dealerTaskStatusService.getAll(),
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Statuses</CardTitle>
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
  return <TaskStatusesEditor key={seedKey} initial={statuses} />
}

function TaskStatusesEditor({ initial }) {
  const queryClient = useQueryClient()
  // Per-instance radio group name so a second mount can't share the "done" selection.
  const doneGroup = useId()
  const [rows, setRows] = useState(() => {
    // Only ONE column may be the "Done" column. Normalize any legacy multi-done data on seed by
    // keeping the first done and clearing the rest.
    let doneSeen = false
    return initial.map((s) => {
      const isDone = Boolean(s.isDone) && !doneSeen
      if (isDone) doneSeen = true
      return {
        _key: s.statusId,
        statusId: s.statusId,
        statusName: s.statusName,
        colour: toHexColour(s.colour),
        isDone,
      }
    })
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      dealerTaskStatusService.sync(
        rows.map((r) => ({
          ...(r.statusId ? { statusId: r.statusId } : {}),
          statusName: r.statusName.trim(),
          colour: r.colour,
          isDone: r.isDone,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-task-statuses'] })
      toast({ title: 'Task statuses saved', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not save task statuses', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  // Exactly one "Done" column: mark `key` done and clear the rest. `null` clears all (no done column).
  const setDone = (key) => setRows((rs) => rs.map((r) => ({ ...r, isDone: r._key === key })))
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r._key !== key))
  const addRow = () => setRows((rs) => [...rs, { _key: `new-${tmpId++}`, statusName: '', colour: '#3b82f6', isDone: false }])
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
          <CardTitle className="text-base">Task Statuses</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            These are the columns of your Task Board. Reorder them and pick the single "Done column" so tasks moved there count as completed.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="mr-1.5 h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No task-board columns yet. Add one (e.g. "To-Do", "In Progress", "Done") to build your board.
          </p>
        ) : (
          rows.map((r, i) => (
            <div key={r._key} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
              <input
                type="color"
                value={toHexColour(r.colour)}
                onChange={(e) => update(r._key, { colour: e.target.value })}
                className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-card"
                aria-label="Status colour"
              />
              <Input
                value={r.statusName}
                onChange={(e) => update(r._key, { statusName: e.target.value })}
                placeholder="Column name"
                className="min-w-[160px] flex-1"
              />
              <div className="flex shrink-0 items-center gap-2" title="The single column whose tasks count as completed">
                <input
                  type="radio"
                  id={`done-${r._key}`}
                  name={doneGroup}
                  className="h-4 w-4 cursor-pointer accent-primary"
                  checked={r.isDone}
                  // onChange fires when picking an unchecked one; onClick also lets you toggle the
                  // currently-selected one OFF (→ no done column). Only one can ever be done.
                  onChange={() => setDone(r._key)}
                  onClick={() => {
                    if (r.isDone) setDone(null)
                  }}
                />
                <Label htmlFor={`done-${r._key}`} className="cursor-pointer text-sm font-normal text-muted-foreground">
                  Done column
                </Label>
              </div>
              <div className="flex shrink-0 items-center gap-1">
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
