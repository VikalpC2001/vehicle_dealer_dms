import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { RtoServiceFormDialog } from '@/components/forms/RtoServiceFormDialog'
import { DataTable } from '@/components/tables/DataTable'
import { TableToolbar, TableToolbarActions } from '@/components/tables/TableToolbar'
import { rtoServiceService, getRtoServiceId } from '@/services/rtoServiceService'
import { getErrorMessage } from '@/lib/authErrors'
import { PAGE_SIZE } from '@/lib/pagination'
import { toast } from '@/hooks/use-toast'

const RTO_PAGE_SIZE = PAGE_SIZE.location

/**
 * Super-admin management of the RTO services catalog (name transfer, insurance, …) that dealers
 * assign to agents. Create/edit/delete; a service in use by an assignment cannot be deleted.
 */
export default function RtoServices() {
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editService, setEditService] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['rto-services', page, RTO_PAGE_SIZE],
    queryFn: () => rtoServiceService.getAll({ page, limit: RTO_PAGE_SIZE }),
  })

  const services = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rto-services'] })
    queryClient.invalidateQueries({ queryKey: ['rto-services-all'] })
  }

  const createMutation = useMutation({
    mutationFn: rtoServiceService.create,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Service added', description: 'New RTO service created.', variant: 'success' })
      setFormOpen(false)
    },
    onError: (err) => toast({ title: 'Failed to add service', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => rtoServiceService.update(id, payload),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Service updated', variant: 'success' })
      setEditService(null)
    },
    onError: (err) => toast({ title: 'Failed to update service', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: rtoServiceService.delete,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Service deleted', variant: 'success' })
      setDeleteTarget(null)
      if (services.length === 1 && page > 1) setPage((current) => current - 1)
    },
    onError: (err) => toast({ title: 'Could not delete service', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const columns = useMemo(
    () => [
      {
        label: '#',
        render: (_row, index) => (
          <span className="text-muted-foreground">{(page - 1) * RTO_PAGE_SIZE + index + 1}</span>
        ),
      },
      {
        key: 'serviceName',
        label: 'Service Name',
        render: (row) => <span className="font-semibold">{row.serviceName}</span>,
      },
      {
        key: 'shortName',
        label: 'Short Name',
        render: (row) => <Badge variant="outline">{row.shortName}</Badge>,
      },
      {
        label: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditService(row)} aria-label="Edit service">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} aria-label="Delete service">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [page]
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">RTO Services</h1>
        <p className="text-muted-foreground mt-1">
          Manage the catalog of RTO services dealers assign to agents.
        </p>
      </motion.div>

      <TableToolbar>
        <div />
        <TableToolbarActions>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Service
          </Button>
        </TableToolbarActions>
      </TableToolbar>

      <DataTable
        mode="server"
        columns={columns}
        data={services}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={RTO_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="services"
        emptyTitle="No RTO services yet"
        emptyDescription="Add your first RTO service to get started."
        showExport={false}
        selectable={false}
        getRowId={getRtoServiceId}
      />

      <RtoServiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add RTO Service"
        description="Create a new RTO service (e.g. Name Transfer)."
        onSubmit={(values) => createMutation.mutateAsync(values)}
        loading={createMutation.isPending}
        submitLabel="Add Service"
      />

      <RtoServiceFormDialog
        open={!!editService}
        onOpenChange={(open) => !open && setEditService(null)}
        title="Edit RTO Service"
        description={`Update ${editService?.serviceName ?? 'service'}.`}
        defaultValues={editService ?? undefined}
        onSubmit={(values) => updateMutation.mutateAsync({ id: getRtoServiceId(editService), payload: values })}
        loading={updateMutation.isPending}
        submitLabel="Save Changes"
      />

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete RTO Service"
        description={`Delete "${deleteTarget?.serviceName}"? A service in use by an assignment cannot be deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getRtoServiceId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
