import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, CheckCircle, XCircle, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchInput } from '@/components/common/SearchInput'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { TableToolbar, TableToolbarSearch, TableToolbarFilters } from '@/components/tables/TableToolbar'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { requestService } from '@/services/requestService'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'

export default function Requests() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [confirmAction, setConfirmAction] = useState(null)
  const debouncedSearch = useDebounce(search)
  const queryClient = useQueryClient()

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['requests', statusFilter, debouncedSearch],
    queryFn: () => requestService.getAll({ status: statusFilter, search: debouncedSearch }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => requestService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast({ title: 'Request Updated', description: 'The request status has been changed.', variant: 'success' })
      setConfirmAction(null)
    },
  })

  const columns = [
    { key: 'id', label: 'Request ID', sortable: true },
    { key: 'userName', label: 'User', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (row) => formatDate(row.date) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'priority', label: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
    {
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
          {row.status === 'pending' && (
            <>
              <Button variant="ghost" size="icon" onClick={() => setConfirmAction({ request: row, status: 'approved', label: 'Approve' })}>
                <CheckCircle className="h-4 w-4 text-success" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setConfirmAction({ request: row, status: 'rejected', label: 'Reject' })}>
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => setConfirmAction({ request: row, status: 'in_progress', label: 'Assign' })}>
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Request Management</h1>
        <p className="text-muted-foreground mt-1">Review and process dealer & agent requests</p>
      </div>

      <TableToolbar>
        <TableToolbarSearch>
          <SearchInput value={search} onChange={setSearch} placeholder="Search requests..." />
        </TableToolbarSearch>
        <TableToolbarFilters>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
        </TableToolbarFilters>
      </TableToolbar>

      <DataTable
        columns={columns}
        data={requests}
        exportFilename="requests.csv"
        isLoading={isLoading}
        itemLabel="requests"
        emptyTitle="No requests found"
        emptyDescription="Try adjusting your search or status filter."
      />

      <ConfirmModal
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
        title={`${confirmAction?.label} Request`}
        description={`Are you sure you want to ${confirmAction?.label?.toLowerCase()} request ${confirmAction?.request?.id}?`}
        confirmLabel={confirmAction?.label || 'Confirm'}
        variant={confirmAction?.status === 'rejected' ? 'destructive' : 'default'}
        onConfirm={() => updateMutation.mutate({ id: confirmAction.request.id, status: confirmAction.status })}
        loading={updateMutation.isPending}
      />
    </div>
  )
}
