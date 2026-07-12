import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Trash2, Loader2, Mail, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { agentUserService } from '@/services/agentUserService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

const EMPTY = { userName: '', emailId: '', mobileNo: '', password: '' }

/**
 * Manage the agent's staff (sub-users). Creating one makes a verified user that
 * can log in immediately and work the agent's assignments.
 */
export function AgentSubUsersPanel() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['agent-wise-users'],
    queryFn: () => agentUserService.getAll(),
  })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['agent-wise-users'] })

  const createMutation = useMutation({
    mutationFn: () => agentUserService.createUser(form),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Staff member added', description: 'They can log in with the password you set.', variant: 'success' })
      setOpen(false)
      setForm(EMPTY)
    },
    onError: (err) => toast({ title: 'Could not add staff member', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (awuId) => agentUserService.remove(awuId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Staff member removed', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Could not remove', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const canSave =
    form.userName.trim() && form.emailId.trim() && form.mobileNo.trim() && form.password.length >= 8

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Staff</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">People in your firm who can work your assignments.</p>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY); setOpen(true) }}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Add Staff
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {links.map((link) => (
              <div key={link.awuId} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="font-medium">{link.user?.userName}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {link.user?.emailId && (
                      <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {link.user.emailId}</span>
                    )}
                    {link.user?.mobileNo && (
                      <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {link.user.mobileNo}</span>
                    )}
                  </div>
                </div>
                {link.userId === currentUser?.id || link.user?.userId === currentUser?.id ? (
                  <Badge variant="secondary">You</Badge>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(link)} aria-label="Remove staff member">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff</DialogTitle>
            <DialogDescription>Creates a verified login they can use immediately.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave) createMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="userName">Name</Label>
              <Input id="userName" value={form.userName} onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))} placeholder="Staff name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailId">Email</Label>
              <Input id="emailId" type="email" value={form.emailId} onChange={(e) => setForm((f) => ({ ...f, emailId: e.target.value }))} placeholder="staff@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobileNo">Mobile</Label>
              <Input id="mobileNo" value={form.mobileNo} onChange={(e) => setForm((f) => ({ ...f, mobileNo: e.target.value }))} placeholder="9876543210" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters" />
              {form.password.length > 0 && form.password.length < 8 && (
                <p className="text-sm text-destructive">Password must be at least 8 characters.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={!canSave || createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : 'Create staff member'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Remove staff member"
        description={`Remove ${deleteTarget?.user?.userName ?? 'this staff member'} from your firm? Their login will no longer be linked to you.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(deleteTarget?.awuId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
