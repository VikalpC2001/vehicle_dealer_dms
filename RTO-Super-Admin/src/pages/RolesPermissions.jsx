import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, ShieldCheck } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { AnimatedTabsList, AnimatedTabPanel } from '@/components/common/AnimatedTabs'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { useCapabilities } from '@/hooks/useCapabilities'
import { dealerRoleService, getDealerRoleId } from '@/services/dealerRoleService'
import { dealerUserService } from '@/services/dealerUserService'
import { getErrorMessage } from '@/lib/authErrors'
import { getInitials } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

const NO_ROLE = '__none__'

/** Groups the capability catalog by `group`, preserving the catalog's group order. */
function groupCapabilities(caps) {
  const order = []
  const byGroup = new Map()
  for (const cap of caps) {
    if (!byGroup.has(cap.group)) {
      byGroup.set(cap.group, [])
      order.push(cap.group)
    }
    byGroup.get(cap.group).push(cap)
  }
  return order.map((name) => ({ name, items: byGroup.get(name) }))
}

export default function RolesPermissions() {
  const { isOwner, can, isLoading } = useCapabilities()
  const [tab, setTab] = useState('roles')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  const allowed = isOwner || can('roles.manage')
  if (!allowed) {
    return (
      <EmptyState
        title="You don't have access to manage roles"
        description="Ask a dealership owner to grant you the “Manage roles & permissions” capability."
      />
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Roles &amp; Permissions</h1>
        </div>
        <p className="text-muted-foreground">
          Define capability-based roles and assign them to your team members.
        </p>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <AnimatedTabsList
          layoutId="roles-permissions-tabs"
          value={tab}
          tabs={[
            { value: 'roles', label: 'Roles' },
            { value: 'team', label: 'Team' },
          ]}
        />
        <AnimatedTabPanel value="roles">
          <RolesSection />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="team">
          <TeamSection />
        </AnimatedTabPanel>
      </Tabs>
    </div>
  )
}

function RolesSection() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editRole, setEditRole] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['dealer-roles'],
    queryFn: () => dealerRoleService.getAll(),
  })

  const { data: capabilities = [] } = useQuery({
    queryKey: ['dealer-roles', 'capabilities'],
    queryFn: () => dealerRoleService.getCapabilities(),
    staleTime: Infinity,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => dealerRoleService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-roles'] })
      toast({ title: 'Role created', description: 'The new role is ready to assign.', variant: 'success' })
      setAddOpen(false)
    },
    onError: (err) =>
      toast({ title: 'Could not create role', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => dealerRoleService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-roles'] })
      toast({ title: 'Role updated', description: 'Changes take effect immediately.', variant: 'success' })
      setEditRole(null)
    },
    onError: (err) =>
      toast({ title: 'Could not update role', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => dealerRoleService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-roles'] })
      queryClient.invalidateQueries({ queryKey: ['dealer-users'] })
      toast({ title: 'Role deleted', description: 'Members dropped to read-only access.', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) =>
      toast({ title: 'Could not delete role', description: getErrorMessage(err), variant: 'destructive' }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {roles.length} {roles.length === 1 ? 'role' : 'roles'}
        </p>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Role
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <EmptyState
          title="No roles yet"
          description="Create your first role to grant employees scoped access."
        />
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <Card key={getDealerRoleId(role)}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <p className="font-semibold">{role.roleName}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {role.capabilities?.length ?? 0}{' '}
                      {(role.capabilities?.length ?? 0) === 1 ? 'permission' : 'permissions'}
                    </Badge>
                    <Badge variant="outline">
                      {role.memberCount ?? 0} {(role.memberCount ?? 0) === 1 ? 'member' : 'members'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditRole(role)} aria-label="Edit role">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(role)}
                    aria-label="Delete role"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RoleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        role={null}
        capabilities={capabilities}
        onSubmit={(payload) => createMutation.mutate(payload)}
        loading={createMutation.isPending}
      />

      <RoleDialog
        open={!!editRole}
        onOpenChange={(open) => !open && setEditRole(null)}
        role={editRole}
        capabilities={capabilities}
        onSubmit={(payload) => updateMutation.mutate({ id: getDealerRoleId(editRole), payload })}
        loading={updateMutation.isPending}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Role"
        description={`Delete “${deleteTarget?.roleName ?? 'this role'}”? Its ${deleteTarget?.memberCount ?? 0} member(s) will drop to read-only access. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getDealerRoleId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function RoleDialog({ open, onOpenChange, role, capabilities, onSubmit, loading }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {/* Keyed so the body remounts (fresh state) each time a role/add dialog opens — no
            state-syncing effect needed. */}
        {open && (
          <RoleDialogBody
            key={getDealerRoleId(role) ?? 'new'}
            role={role}
            capabilities={capabilities}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
            loading={loading}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RoleDialogBody({ role, capabilities, onCancel, onSubmit, loading }) {
  const isEdit = !!role
  const [roleName, setRoleName] = useState(role?.roleName ?? '')
  const [selected, setSelected] = useState(role?.capabilities ?? [])
  const [nameError, setNameError] = useState('')

  const groups = useMemo(() => groupCapabilities(capabilities), [capabilities])

  const toggle = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleSave = () => {
    const name = roleName.trim()
    if (name.length < 1) {
      setNameError('Role name is required')
      return
    }
    onSubmit({ roleName: name, capabilities: selected })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Role' : 'Add Role'}</DialogTitle>
        <DialogDescription>
          Name the role and choose the capabilities its members should have.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="roleName">Role name</Label>
        <Input
          id="roleName"
          placeholder="e.g. Front Desk"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
        />
        {nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.name} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.name}
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {group.items.map((cap) => (
                <label
                  key={cap.key}
                  htmlFor={`cap-${cap.key}`}
                  className="flex cursor-pointer items-center justify-between gap-4 p-3"
                >
                  <span className="text-sm">{cap.label}</span>
                  <Switch
                    id={`cap-${cap.key}`}
                    checked={selected.includes(cap.key)}
                    onCheckedChange={() => toggle(cap.key)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Role'}
        </Button>
      </DialogFooter>
    </>
  )
}

function TeamSection() {
  const queryClient = useQueryClient()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['dealer-users'],
    queryFn: () => dealerUserService.getAll(),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['dealer-roles'],
    queryFn: () => dealerRoleService.getAll(),
  })

  const assignMutation = useMutation({
    mutationFn: ({ userId, roleId }) => dealerRoleService.assign(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-users'] })
      queryClient.invalidateQueries({ queryKey: ['dealer-roles'] })
      toast({ title: 'Role updated', description: 'The member’s access has been updated.', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not update role', description: getErrorMessage(err), variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <EmptyState
        title="No team members"
        description="Add employees from Settings to assign them roles here."
      />
    )
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const user = member.user ?? {}
        const name = user.userName || user.emailId || 'Employee'
        const pending = assignMutation.isPending && assignMutation.variables?.userId === member.userId
        return (
          <Card key={member.userId}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="gradient-bg text-xs text-white">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  {user.emailId && <p className="truncate text-xs text-muted-foreground">{user.emailId}</p>}
                </div>
              </div>

              {member.isOwner ? (
                <Badge variant="success">Owner — full access</Badge>
              ) : (
                <Select
                  value={member.roleId ?? NO_ROLE}
                  onValueChange={(value) =>
                    assignMutation.mutate({
                      userId: member.userId,
                      roleId: value === NO_ROLE ? null : value,
                    })
                  }
                  disabled={pending}
                >
                  <SelectTrigger className="w-full sm:w-60">
                    <SelectValue placeholder="No role (read-only)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ROLE}>No role (read-only)</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={getDealerRoleId(role)} value={getDealerRoleId(role)}>
                        {role.roleName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
