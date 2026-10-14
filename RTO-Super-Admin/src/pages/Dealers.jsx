import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, Store, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { DealerFormDialog } from '@/components/dealers/DealerFormDialog'
import { AgentSlotsDialog } from '@/components/dealers/AgentSlotsDialog'
import { DataTable } from '@/components/tables/DataTable'
import { dealerService, getDealerId } from '@/services/dealerService'
import { getErrorMessage } from '@/lib/authErrors'
import { PAGE_SIZE } from '@/lib/pagination'
import { toast } from '@/hooks/use-toast'
import { defaultDealerValues } from '@/components/forms/DealerForm'

const DEALER_PAGE_SIZE = PAGE_SIZE.crud

function mapDealerToForm(dealer) {
  if (!dealer) return defaultDealerValues
  return {
    firmName: dealer.firmName ?? '',
    dealerName: dealer.dealerName ?? '',
    address: dealer.address ?? '',
    city: dealer.city ?? '',
    state: dealer.state ?? '',
    pincode: dealer.pincode ?? '',
    mobileNo: dealer.mobileNo ?? '',
    emailId: dealer.emailId ?? '',
    displayName: dealer.displayName ?? '',
    whatsappNo: dealer.whatsappNo ?? '',
    isSubscribe: Boolean(dealer.isSubscribe),
  }
}

export default function Dealers() {
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editDealer, setEditDealer] = useState(null)
  const [slotsDealer, setSlotsDealer] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pauseTarget, setPauseTarget] = useState(null) // dealer awaiting the "pause access" confirmation
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['dealers', page, DEALER_PAGE_SIZE],
    queryFn: () => dealerService.getAll({ page, limit: DEALER_PAGE_SIZE }),
  })

  const dealers = data?.dealers ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const createMutation = useMutation({
    mutationFn: dealerService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealers'] })
      toast({ title: 'Dealer added', description: 'New dealer has been created successfully.', variant: 'success' })
      setFormOpen(false)
    },
    onError: (err) => {
      toast({ title: 'Failed to add dealer', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => dealerService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealers'] })
      toast({ title: 'Dealer updated', description: 'Dealer details saved successfully.', variant: 'success' })
      setEditDealer(null)
    },
    onError: (err) => {
      toast({ title: 'Failed to update dealer', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => dealerService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealers'] })
      toast({ title: 'Dealer deleted', description: 'The dealer has been removed.', variant: 'success' })
      setDeleteTarget(null)
      if (dealers.length === 1 && page > 1) setPage((current) => current - 1)
    },
    onError: (err) => {
      toast({ title: 'Failed to delete dealer', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  // Pause / resume the dealer firm's access (PATCH /dealers/:id/access). Pausing signs every user
  // of the firm out, so it goes through a confirmation; resuming applies straight away.
  const { mutate: setAccess, isPending: accessPending } = useMutation({
    mutationFn: ({ id, isActive }) => dealerService.setAccess(id, isActive),
    onSuccess: (_res, vars) => {
      toast({
        title: vars.isActive ? 'Access resumed' : 'Access paused',
        description: vars.isActive
          ? 'The dealer and its users can sign in again.'
          : 'The dealer and its users are signed out until access is resumed.',
        variant: 'success',
      })
      setPauseTarget(null)
      // Returned so the mutation stays pending (switches disabled) until the refreshed rows are in.
      return queryClient.invalidateQueries({ queryKey: ['dealers'] })
    },
    onError: (err) => {
      toast({ title: 'Failed to update access', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const handleCreate = async (values) => {
    await createMutation.mutateAsync(values)
  }

  const handleUpdate = async (values) => {
    const id = getDealerId(editDealer)
    await updateMutation.mutateAsync({ id, payload: values })
  }

  const openEdit = async (dealer) => {
    const id = getDealerId(dealer)
    try {
      const fresh = await dealerService.getById(id)
      setEditDealer(fresh)
    } catch {
      setEditDealer(dealer)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'firmName',
        label: 'Firm Name',
        render: (row) => <span className="font-semibold">{row.firmName}</span>,
      },
      { key: 'dealerName', label: 'Dealer Name' },
      { key: 'city', label: 'City' },
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
          // Placeholder dealers have no login, so there is no access to pause.
          if (row.isPlaceholder) return <span className="text-muted-foreground">—</span>
          const active = row.isActive !== false
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={active}
                disabled={accessPending}
                onCheckedChange={(checked) =>
                  checked ? setAccess({ id: getDealerId(row), isActive: true }) : setPauseTarget(row)
                }
                aria-label={`Access for ${row.firmName ?? 'dealer'}`}
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
            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Edit dealer">
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSlotsDealer(row)}
              aria-label="Set agent slots"
              title="Agent slots"
            >
              <UserCog className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(row)}
              aria-label="Delete dealer"
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
          <h1 className="text-3xl font-bold">Dealer Management</h1>
          <p className="text-muted-foreground mt-1">Add, view, update, and remove registered dealers</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Dealer
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-bg">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">Total Dealers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        mode="server"
        columns={columns}
        data={dealers}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={DEALER_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="dealers"
        emptyTitle="No dealers found"
        emptyDescription="Add your first dealer to get started."
        showExport={false}
        selectable={false}
        getRowId={getDealerId}
      />

      <DealerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add New Dealer"
        description="Fill in the dealer details below. All fields marked in validation are required."
        onSubmit={handleCreate}
        loading={createMutation.isPending}
        submitLabel="Add Dealer"
      />

      <DealerFormDialog
        open={!!editDealer}
        onOpenChange={(open) => !open && setEditDealer(null)}
        title="Edit Dealer"
        description={`Update details for ${editDealer?.firmName ?? 'dealer'}.`}
        defaultValues={mapDealerToForm(editDealer)}
        onSubmit={handleUpdate}
        loading={updateMutation.isPending}
        submitLabel="Save Changes"
      />

      <AgentSlotsDialog
        open={!!slotsDealer}
        onOpenChange={(open) => !open && setSlotsDealer(null)}
        dealer={slotsDealer}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Dealer"
        description={`Are you sure you want to delete ${deleteTarget?.firmName ?? 'this dealer'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getDealerId(deleteTarget))}
        loading={deleteMutation.isPending}
      />

      <ConfirmModal
        open={!!pauseTarget}
        onOpenChange={() => setPauseTarget(null)}
        title="Pause Dealer Access"
        description={`Pause access for ${pauseTarget?.firmName ?? 'this dealer'}? All users of this firm will be signed out immediately and cannot sign in until access is resumed.`}
        confirmLabel="Pause Access"
        variant="destructive"
        onConfirm={() => setAccess({ id: getDealerId(pauseTarget), isActive: false })}
        loading={accessPending}
      />
    </div>
  )
}
