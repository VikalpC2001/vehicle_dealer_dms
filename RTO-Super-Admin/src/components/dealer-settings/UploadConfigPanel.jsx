import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { dealerWiseUploadCategoryService } from '@/services/dealerWiseUploadCategoryService'
import { uploadCategoryService } from '@/services/uploadCategoryService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/** Body for create/update — the link's full flag set (PATCH is a full replace). */
function linkBody(item, overrides = {}) {
  return {
    uploadCategoryId: item.categoryId ?? item.uploadCategoryId,
    isRequired: item.isRequired ?? false,
    isProcess: item.isProcess ?? false,
    isViewInStep: item.isViewInStep ?? false,
    ...overrides,
  }
}

/**
 * Configure which document categories appear in the create-process wizard, and their
 * required/visible flags and order. Dealers link existing GLOBAL categories. The OCR extraction API
 * is managed centrally by the super-admin (Document Categories) and inherited here.
 */
export function UploadConfigPanel() {
  const queryClient = useQueryClient()
  const { data: configured = [], isLoading } = useQuery({
    queryKey: ['dealer-wise-upload-categories', 'config'],
    queryFn: () => dealerWiseUploadCategoryService.getAll(),
  })
  const { data: globals = [] } = useQuery({
    queryKey: ['upload-categories'],
    queryFn: () => uploadCategoryService.getAll(),
  })

  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState({ uploadCategoryId: '', isRequired: false, isViewInStep: true })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dealer-wise-upload-categories'] })

  const linkedIds = useMemo(() => new Set(configured.map((c) => c.categoryId)), [configured])
  const available = useMemo(() => globals.filter((g) => !linkedIds.has(g.categoryId)), [globals, linkedIds])

  const createMutation = useMutation({
    mutationFn: () =>
      dealerWiseUploadCategoryService.create({
        uploadCategoryId: pick.uploadCategoryId,
        isRequired: pick.isRequired,
        isProcess: false,
        isViewInStep: pick.isViewInStep,
      }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Document added', variant: 'success' })
      setOpen(false)
    },
    onError: (err) => toast({ title: 'Could not add', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ dwucId, body }) => dealerWiseUploadCategoryService.update(dwucId, body),
    onSuccess: () => invalidate(),
    onError: (err) => toast({ title: 'Could not update', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (dwucId) => dealerWiseUploadCategoryService.remove(dwucId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Document removed', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Could not remove', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const reorderMutation = useMutation({
    mutationFn: (items) => dealerWiseUploadCategoryService.updateOrder(items),
    onSuccess: () => invalidate(),
    onError: (err) => toast({ title: 'Could not reorder', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const toggle = (item, field, value) =>
    updateMutation.mutate({ dwucId: item.dwucId, body: linkBody(item, { [field]: value }) })

  const move = (index, dir) => {
    const j = index + dir
    if (j < 0 || j >= configured.length) return
    const copy = [...configured]
    ;[copy[index], copy[j]] = [copy[j], copy[index]]
    reorderMutation.mutate(copy.map((c, i) => ({ dwucId: c.dwucId, orderRank: i + 1 })))
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Wizard Documents</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Which documents appear when creating a process, whether they&apos;re required, and their order.
          </p>
        </div>
        <Button size="sm" onClick={() => { setPick({ uploadCategoryId: '', isRequired: false, isViewInStep: true }); setOpen(true) }} disabled={available.length === 0}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Document
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : configured.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents configured. Add one so it shows in the wizard.</p>
        ) : (
          <div className="divide-y divide-border">
            {configured.map((item, i) => (
              <div key={item.dwucId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.categoryName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={Boolean(item.isRequired)} onCheckedChange={(v) => toggle(item, 'isRequired', v)} />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={Boolean(item.isViewInStep)} onCheckedChange={(v) => toggle(item, 'isViewInStep', v)} />
                    Show in wizard
                  </label>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0 || reorderMutation.isPending} aria-label="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === configured.length - 1 || reorderMutation.isPending} aria-label="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)} aria-label="Remove document">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>Pick a document type to include in the create-process wizard.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (pick.uploadCategoryId) createMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="uploadCategoryId">Document type</Label>
              <Select value={pick.uploadCategoryId || undefined} onValueChange={(v) => setPick((p) => ({ ...p, uploadCategoryId: v }))}>
                <SelectTrigger id="uploadCategoryId">
                  <SelectValue placeholder={available.length ? 'Select a category' : 'All categories already added'} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((g) => (
                    <SelectItem key={g.categoryId} value={g.categoryId}>{g.categoryName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-sm">Required</span>
              <Switch checked={pick.isRequired} onCheckedChange={(v) => setPick((p) => ({ ...p, isRequired: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-sm">Show in wizard</span>
              <Switch checked={pick.isViewInStep} onCheckedChange={(v) => setPick((p) => ({ ...p, isViewInStep: v }))} />
            </div>
            <Button type="submit" className="w-full" disabled={!pick.uploadCategoryId || createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…</> : 'Add'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Remove document"
        description={`Remove "${deleteTarget?.categoryName ?? 'this document'}" from the wizard?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(deleteTarget?.dwucId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
