import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { StateFormDialog } from '@/components/locations/StateFormDialog'
import { DataTable } from '@/components/tables/DataTable'
import { TableToolbar, TableToolbarActions } from '@/components/tables/TableToolbar'
import { stateService, getStateId } from '@/services/stateService'
import { getErrorMessage } from '@/lib/authErrors'
import { PAGE_SIZE } from '@/lib/pagination'
import { toast } from '@/hooks/use-toast'

const STATE_PAGE_SIZE = PAGE_SIZE.location

export function StatesTab() {
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editState, setEditState] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['states', page, STATE_PAGE_SIZE],
    queryFn: () => stateService.getAll({ page, limit: STATE_PAGE_SIZE }),
  })

  const states = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const createMutation = useMutation({
    mutationFn: stateService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states'] })
      queryClient.invalidateQueries({ queryKey: ['states-ddl'] })
      toast({ title: 'State added', description: 'New state created successfully.', variant: 'success' })
      setFormOpen(false)
    },
    onError: (err) => toast({ title: 'Failed to add state', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => stateService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states'] })
      queryClient.invalidateQueries({ queryKey: ['states-ddl'] })
      toast({ title: 'State updated', description: 'State saved successfully.', variant: 'success' })
      setEditState(null)
    },
    onError: (err) => toast({ title: 'Failed to update state', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: stateService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states'] })
      queryClient.invalidateQueries({ queryKey: ['states-ddl'] })
      queryClient.invalidateQueries({ queryKey: ['cities'] })
      toast({ title: 'State deleted', description: 'State has been removed.', variant: 'success' })
      setDeleteTarget(null)
      if (states.length === 1 && page > 1) setPage((current) => current - 1)
    },
    onError: (err) => toast({ title: 'Failed to delete state', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const columns = useMemo(
    () => [
      {
        label: '#',
        render: (_row, index) => (
          <span className="text-muted-foreground">{(page - 1) * STATE_PAGE_SIZE + index + 1}</span>
        ),
      },
      {
        key: 'stateName',
        label: 'State Name',
        render: (row) => <span className="font-semibold">{row.stateName}</span>,
      },
      {
        label: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditState(row)} aria-label="Edit state">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} aria-label="Delete state">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [page]
  )

  return (
    <div className="space-y-4">
      <TableToolbar>
        <div />
        <TableToolbarActions>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add State
          </Button>
        </TableToolbarActions>
      </TableToolbar>

      <DataTable
        mode="server"
        columns={columns}
        data={states}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={STATE_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="states"
        emptyTitle="No states found"
        emptyDescription="Add your first state to get started."
        showExport={false}
        selectable={false}
        getRowId={getStateId}
      />

      <StateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add State"
        description="Enter the name of the new state."
        onSubmit={(values) => createMutation.mutateAsync(values)}
        loading={createMutation.isPending}
        submitLabel="Add State"
      />

      <StateFormDialog
        open={!!editState}
        onOpenChange={(open) => !open && setEditState(null)}
        title="Edit State"
        description={`Update state name for ${editState?.stateName ?? 'state'}.`}
        defaultValues={{ stateName: editState?.stateName }}
        onSubmit={(values) => updateMutation.mutateAsync({ id: getStateId(editState), payload: values })}
        loading={updateMutation.isPending}
        submitLabel="Save Changes"
      />

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete State"
        description={`Delete ${deleteTarget?.stateName}? Cities linked to this state may be affected.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getStateId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
