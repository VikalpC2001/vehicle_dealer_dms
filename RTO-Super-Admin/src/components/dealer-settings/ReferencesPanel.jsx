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
import { dealerReferenceService } from '@/services/dealerReferenceService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

function refId(r) {
  return r?.referenceId ?? r?.id
}

/**
 * CRUD for the dealer's references (the people who introduce buy/sell deals).
 */
export function ReferencesPanel() {
  const queryClient = useQueryClient()
  const { data: refs = [], isLoading } = useQuery({
    queryKey: ['dealer-references', 'all'],
    queryFn: () => dealerReferenceService.getAll(),
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ referenceName: '', referenceNumber: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dealer-references'] })

  const openAdd = () => {
    setEditing(null)
    setForm({ referenceName: '', referenceNumber: '' })
    setOpen(true)
  }
  const openEdit = (r) => {
    setEditing(r)
    setForm({ referenceName: r.referenceName, referenceNumber: r.referenceNumber })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? dealerReferenceService.update(refId(editing), form)
        : dealerReferenceService.create(form),
    onSuccess: () => {
      invalidate()
      toast({ title: editing ? 'Reference updated' : 'Reference added', variant: 'success' })
      setOpen(false)
    },
    onError: (err) => toast({ title: 'Could not save', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => dealerReferenceService.remove(id),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Reference removed', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Could not remove', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const canSave = form.referenceName.trim() && form.referenceNumber.trim()

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">References</CardTitle>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Reference
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : refs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No references yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {refs.map((r) => (
              <div key={refId(r)} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{r.referenceName}</p>
                  <p className="text-sm text-muted-foreground">{r.referenceNumber}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Edit reference">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)} aria-label="Delete reference">
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
            <DialogTitle>{editing ? 'Edit Reference' : 'Add Reference'}</DialogTitle>
            <DialogDescription>Name and contact number, unique within your account.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave) saveMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="referenceName">Name</Label>
              <Input
                id="referenceName"
                value={form.referenceName}
                onChange={(e) => setForm((f) => ({ ...f, referenceName: e.target.value }))}
                placeholder="Reference name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Number</Label>
              <Input
                id="referenceNumber"
                value={form.referenceNumber}
                onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                placeholder="9876543210"
              />
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
        title="Remove reference"
        description={`Remove ${deleteTarget?.referenceName ?? 'this reference'}?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(refId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
