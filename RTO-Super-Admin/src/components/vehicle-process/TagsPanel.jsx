import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { TagChip } from '@/components/vehicle-process/TagChip'
import { dealerTagService } from '@/services/dealerTagService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

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
 * Coerce a stored colour (hex OR a CSS name like 'blue'/'Yellow'/'green') into a `#RRGGBB` value the
 * native `<input type="color">` can display — otherwise named colours all collapse to the fallback
 * and the picker looks broken. Saving then persists proper hex.
 */
function toHexColour(colour) {
  if (typeof colour === 'string') {
    if (/^#[0-9a-fA-F]{6}$/.test(colour)) return colour
    const named = NAMED_HEX[colour.trim().toLowerCase()]
    if (named) return named
  }
  return '#3b82f6'
}

function tagId(t) {
  return t?.tagId ?? t?.id
}

/**
 * CRUD for the dealer's Finder-style tags — colored labels applied (multiple) to a vehicle process,
 * replacing the old process-status surfacing in the vehicle list. Each tag has a name and a colour.
 *
 * @param {object} props
 * @param {string} [props.dealerId] - Manage tags for a dealer the caller manages (an agent working a
 *   placeholder/managed dealer). Threaded into every dealerTagService call and the query key; omit it
 *   (dealer Settings usage) to stay token-scoped exactly as before.
 */
export function TagsPanel({ dealerId } = {}) {
  const queryClient = useQueryClient()
  const { data: tags = [], isLoading } = useQuery({
    // Key on dealerId so an agent switching managed dealers doesn't reuse another dealer's tag list.
    queryKey: ['dealer-tags', dealerId ?? null],
    queryFn: () => dealerTagService.getAll(dealerId),
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ tagName: '', colour: '#3b82f6' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Renaming/recolouring/deleting a tag changes the denormalized tag copies carried on processes,
  // so refresh the surfaces that show them too (all prefix-matched).
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dealer-tags'] })
    queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] }) // list
    queryClient.invalidateQueries({ queryKey: ['vehicle-process'] }) // detail (['vehicle-process', id, 'details'])
    queryClient.invalidateQueries({ queryKey: ['process-tasks'] }) // task board + history
    queryClient.invalidateQueries({ queryKey: ['agent-board-processes'] }) // agent board (own)
    queryClient.invalidateQueries({ queryKey: ['agent-assignments'] }) // agent board (assigned)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ tagName: '', colour: '#3b82f6' })
    setOpen(true)
  }
  const openEdit = (t) => {
    setEditing(t)
    setForm({ tagName: t.tagName, colour: toHexColour(t.colour) })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { tagName: form.tagName.trim(), colour: form.colour }
      return editing
        ? dealerTagService.update(tagId(editing), payload, dealerId)
        : dealerTagService.create(payload, dealerId)
    },
    onSuccess: () => {
      invalidate()
      toast({ title: editing ? 'Tag updated' : 'Tag added', variant: 'success' })
      setOpen(false)
    },
    onError: (err) => toast({ title: 'Could not save', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => dealerTagService.remove(id, dealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Tag removed', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Could not remove', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const canSave = Boolean(form.tagName.trim() && form.colour)

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Tags</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Colored labels you can apply (multiple) to a vehicle process — shown in the vehicle list and used to filter it.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Tag
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags yet. Add one (e.g. "Urgent", "Paid", "RC Pending").</p>
        ) : (
          <div className="divide-y divide-border">
            {tags.map((t) => (
              <div key={tagId(t)} className="flex items-center justify-between py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <TagChip name={t.tagName} colour={t.colour} />
                  <span className="truncate font-medium">{t.tagName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="Edit tag">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)} aria-label="Delete tag">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tag' : 'Add Tag'}</DialogTitle>
            <DialogDescription>A tag name and colour, unique within your account.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave) saveMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="tagName">Tag name</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={toHexColour(form.colour)}
                  onChange={(e) => setForm((f) => ({ ...f, colour: e.target.value }))}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-card"
                  aria-label="Tag colour"
                />
                <Input
                  id="tagName"
                  value={form.tagName}
                  onChange={(e) => setForm((f) => ({ ...f, tagName: e.target.value }))}
                  placeholder="e.g. Urgent"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Preview:</span>
              <TagChip name={form.tagName || 'Tag name'} colour={form.colour} />
            </div>
            <Button type="submit" className="w-full" disabled={!canSave || saveMutation.isPending}>
              {saveMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Remove tag"
        description={`Remove ${deleteTarget?.tagName ?? 'this tag'}? It will be removed from any processes it's applied to.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(tagId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
