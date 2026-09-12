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
import { taskTemplateService } from '@/services/taskTemplateService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

function templateId(t) {
  return t?.templateId ?? t?.id
}

/**
 * CRUD for the dealer's job templates — a predefined catalog of jobs (e.g. "PUC", "Insurance",
 * "Name transfer") pickable when creating a task.
 */
export function TaskTemplatesPanel() {
  const queryClient = useQueryClient()
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['task-templates', 'all'],
    queryFn: () => taskTemplateService.getAll(),
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ templateName: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['task-templates'] })

  const openAdd = () => {
    setEditing(null)
    setForm({ templateName: '' })
    setOpen(true)
  }
  const openEdit = (t) => {
    setEditing(t)
    setForm({ templateName: t.templateName })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? taskTemplateService.update(templateId(editing), form)
        : taskTemplateService.create(form),
    onSuccess: () => {
      invalidate()
      toast({ title: editing ? 'Job template updated' : 'Job template added', variant: 'success' })
      setOpen(false)
    },
    onError: (err) => toast({ title: 'Could not save', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => taskTemplateService.remove(id),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Job template removed', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Could not remove', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const canSave = form.templateName.trim()

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Job Templates</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Predefined jobs pickable when creating a task (e.g. "PUC", "Insurance", "Name transfer").
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Job
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No job templates yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {templates.map((t) => (
              <div key={templateId(t)} className="flex items-center justify-between py-3">
                <p className="font-medium">{t.templateName}</p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="Edit job template">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)} aria-label="Delete job template">
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
            <DialogTitle>{editing ? 'Edit Job Template' : 'Add Job Template'}</DialogTitle>
            <DialogDescription>A job name, unique within your account.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave) saveMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="templateName">Job name</Label>
              <Input
                id="templateName"
                value={form.templateName}
                onChange={(e) => setForm((f) => ({ ...f, templateName: e.target.value }))}
                placeholder="e.g. Insurance"
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
        title="Remove job template"
        description={`Remove ${deleteTarget?.templateName ?? 'this job template'}?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(templateId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
