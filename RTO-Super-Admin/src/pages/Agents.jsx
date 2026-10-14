import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, UserCog, KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { AgentFormDialog } from '@/components/agents/AgentFormDialog'
import { DataTable } from '@/components/tables/DataTable'
import { agentService, getAgentId } from '@/services/agentService'
import { getErrorMessage } from '@/lib/authErrors'
import { PAGE_SIZE } from '@/lib/pagination'
import { toast } from '@/hooks/use-toast'
import { defaultAgentValues } from '@/components/forms/AgentForm'

const AGENT_PAGE_SIZE = PAGE_SIZE.crud
const EMPTY_USER = { userName: '', emailId: '', mobileNo: '', password: '' }

function mapAgentToForm(agent) {
  if (!agent) return defaultAgentValues
  return {
    firmName: agent.firmName ?? '',
    agentName: agent.agentName ?? '',
    displayName: agent.displayName ?? '',
    address: agent.address ?? '',
    city: agent.city ?? '',
    state: agent.state ?? '',
    pincode: agent.pincode ?? '',
    mobileNo: agent.mobileNo ?? '',
    emailId: agent.emailId ?? '',
    whatsappNo: agent.whatsappNo ?? '',
    isSubscribe: Boolean(agent.isSubscribe),
  }
}

export default function Agents() {
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editAgent, setEditAgent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pauseTarget, setPauseTarget] = useState(null) // agent awaiting the "pause access" confirmation
  const [userTarget, setUserTarget] = useState(null)
  const [userForm, setUserForm] = useState(EMPTY_USER)
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['agents', page, AGENT_PAGE_SIZE],
    queryFn: () => agentService.getAll({ page, limit: AGENT_PAGE_SIZE }),
  })

  const agents = data?.agents ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const createMutation = useMutation({
    mutationFn: agentService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast({ title: 'Agent added', description: 'New agent has been created successfully.', variant: 'success' })
      setFormOpen(false)
    },
    onError: (err) => {
      toast({ title: 'Failed to add agent', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => agentService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast({ title: 'Agent updated', description: 'Agent details saved successfully.', variant: 'success' })
      setEditAgent(null)
    },
    onError: (err) => {
      toast({ title: 'Failed to update agent', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => agentService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast({ title: 'Agent deleted', description: 'The agent has been removed.', variant: 'success' })
      setDeleteTarget(null)
      if (agents.length === 1 && page > 1) setPage((current) => current - 1)
    },
    onError: (err) => {
      toast({ title: 'Failed to delete agent', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  // Pause / resume the agent firm's access (PATCH /agents/:id/access). Pausing signs every user
  // of the firm out, so it goes through a confirmation; resuming applies straight away.
  const { mutate: setAccess, isPending: accessPending } = useMutation({
    mutationFn: ({ id, isActive }) => agentService.setAccess(id, isActive),
    onSuccess: (_res, vars) => {
      toast({
        title: vars.isActive ? 'Access resumed' : 'Access paused',
        description: vars.isActive
          ? 'The agent and its users can sign in again.'
          : 'The agent and its users are signed out until access is resumed.',
        variant: 'success',
      })
      setPauseTarget(null)
      // Returned so the mutation stays pending (switches disabled) until the refreshed rows are in.
      return queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
    onError: (err) => {
      toast({ title: 'Failed to update access', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const createUserMutation = useMutation({
    mutationFn: () => agentService.createUser({ agentId: getAgentId(userTarget), ...userForm }),
    onSuccess: () => {
      toast({ title: 'Login user created', description: 'The agent can now log in with the password you set.', variant: 'success' })
      setUserTarget(null)
      setUserForm(EMPTY_USER)
    },
    onError: (err) => {
      toast({ title: 'Could not create login user', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const handleCreate = async (values) => {
    await createMutation.mutateAsync(values)
  }

  const handleUpdate = async (values) => {
    const id = getAgentId(editAgent)
    await updateMutation.mutateAsync({ id, payload: values })
  }

  const openEdit = async (agent) => {
    const id = getAgentId(agent)
    try {
      const fresh = await agentService.getById(id)
      setEditAgent(fresh)
    } catch {
      setEditAgent(agent)
    }
  }

  const openUserDialog = (agent) => {
    setUserForm(EMPTY_USER)
    setUserTarget(agent)
  }

  const canSaveUser =
    userForm.userName.trim() && userForm.emailId.trim() && userForm.mobileNo.trim() && userForm.password.length >= 8

  const columns = useMemo(
    () => [
      {
        key: 'firmName',
        label: 'Firm Name',
        render: (row) => <span className="font-semibold">{row.firmName}</span>,
      },
      { key: 'agentName', label: 'Agent Name' },
      { key: 'displayName', label: 'Display Name' },
      { key: 'mobileNo', label: 'Mobile' },
      { key: 'emailId', label: 'Email' },
      {
        key: 'isSubscribe',
        label: 'Subscribed',
        render: (row) => (
          <Badge variant={row.isSubscribe ? 'success' : 'secondary'}>
            {row.isSubscribe ? 'Yes' : 'No'}
          </Badge>
        ),
      },
      {
        key: 'isActive',
        label: 'Access',
        render: (row) => {
          const active = row.isActive !== false
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={active}
                disabled={accessPending}
                onCheckedChange={(checked) =>
                  checked ? setAccess({ id: getAgentId(row), isActive: true }) : setPauseTarget(row)
                }
                aria-label={`Access for ${row.firmName ?? 'agent'}`}
              />
              <Badge variant={active ? 'success' : 'warning'}>{active ? 'Active' : 'Paused'}</Badge>
            </div>
          )
        },
      },
      {
        label: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => openUserDialog(row)} aria-label="Add login user">
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Edit agent">
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(row)}
              aria-label="Delete agent"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    // The Access switch reads the mutation's pending flag, so the columns must follow it.
    [accessPending, setAccess]
  )

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground mt-1">Add, view, update, and remove RTO agents</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Agent
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-bg">
              <UserCog className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">Total Agents</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        mode="server"
        columns={columns}
        data={agents}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={AGENT_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="agents"
        emptyTitle="No agents found"
        emptyDescription="Add your first agent to get started."
        showExport={false}
        selectable={false}
        getRowId={getAgentId}
      />

      <AgentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add New Agent"
        description="Fill in the agent details below. Firm, agent, and display names are required."
        onSubmit={handleCreate}
        loading={createMutation.isPending}
        submitLabel="Add Agent"
      />

      <AgentFormDialog
        open={!!editAgent}
        onOpenChange={(open) => !open && setEditAgent(null)}
        title="Edit Agent"
        description={`Update details for ${editAgent?.firmName ?? 'agent'}.`}
        defaultValues={mapAgentToForm(editAgent)}
        onSubmit={handleUpdate}
        loading={updateMutation.isPending}
        submitLabel="Save Changes"
      />

      <Dialog open={!!userTarget} onOpenChange={(open) => !open && setUserTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Login User</DialogTitle>
            <DialogDescription>
              Creates the owner login for {userTarget?.firmName ?? 'this agent'}. They can log in immediately.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSaveUser) createUserMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="agentUserName">Name</Label>
              <Input
                id="agentUserName"
                value={userForm.userName}
                onChange={(e) => setUserForm((f) => ({ ...f, userName: e.target.value }))}
                placeholder="Owner name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentUserEmail">Email</Label>
              <Input
                id="agentUserEmail"
                type="email"
                value={userForm.emailId}
                onChange={(e) => setUserForm((f) => ({ ...f, emailId: e.target.value }))}
                placeholder="owner@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentUserMobile">Mobile</Label>
              <Input
                id="agentUserMobile"
                value={userForm.mobileNo}
                onChange={(e) => setUserForm((f) => ({ ...f, mobileNo: e.target.value }))}
                placeholder="9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentUserPassword">Password</Label>
              <Input
                id="agentUserPassword"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="At least 8 characters"
              />
              {userForm.password.length > 0 && userForm.password.length < 8 && (
                <p className="text-sm text-destructive">Password must be at least 8 characters.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={!canSaveUser || createUserMutation.isPending}>
              {createUserMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
              ) : (
                'Create login user'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Agent"
        description={`Are you sure you want to delete ${deleteTarget?.firmName ?? 'this agent'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getAgentId(deleteTarget))}
        loading={deleteMutation.isPending}
      />

      <ConfirmModal
        open={!!pauseTarget}
        onOpenChange={() => setPauseTarget(null)}
        title="Pause Agent Access"
        description={`Pause access for ${pauseTarget?.firmName ?? 'this agent'}? All users of this firm will be signed out immediately and cannot sign in until access is resumed.`}
        confirmLabel="Pause Access"
        variant="destructive"
        onConfirm={() => setAccess({ id: getAgentId(pauseTarget), isActive: false })}
        loading={accessPending}
      />
    </div>
  )
}
