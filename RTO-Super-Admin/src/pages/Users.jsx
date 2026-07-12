import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Eye, Edit, Ban, Trash2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/common/SearchInput'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { TableToolbarSearch } from '@/components/tables/TableToolbar'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { userService } from '@/services/userService'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'

const tabs = [
  { value: 'all', label: 'All Users', filter: {} },
  { value: 'dealers', label: 'Dealers', filter: { role: 'dealer' } },
  { value: 'agents', label: 'Agents', filter: { role: 'agent' } },
  { value: 'pending', label: 'Pending Approval', filter: { status: 'pending' } },
  { value: 'suspended', label: 'Suspended', filter: { status: 'suspended' } },
]

export default function Users() {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const debouncedSearch = useDebounce(search)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const currentFilter = tabs.find((t) => t.value === activeTab)?.filter || {}

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', activeTab, debouncedSearch],
    queryFn: () => userService.getAll({ ...currentFilter, search: debouncedSearch }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => userService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Success', description: 'User status updated.', variant: 'success' })
      setConfirmAction(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => userService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Deleted', description: 'User has been removed.', variant: 'success' })
      setConfirmAction(null)
    },
  })

  const columns = [
    {
      key: 'name',
      label: 'User Name',
      sortable: true,
      render: (row) => (
        <button className="font-semibold text-primary hover:underline cursor-pointer" onClick={() => navigate(`/users/${row.id}`)}>
          {row.name}
        </button>
      ),
    },
    { key: 'role', label: 'Role', sortable: true, render: (row) => <Badge variant="secondary" className="capitalize">{row.role}</Badge> },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone' },
    { key: 'plan', label: 'Subscription Plan', sortable: true },
    { key: 'registrationDate', label: 'Registration Date', sortable: true, render: (row) => formatDate(row.registrationDate) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/users/${row.id}`)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/users/${row.id}`)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmAction({ type: 'suspend', user: row })}><Ban className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmAction({ type: 'delete', user: row })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

  const handleConfirm = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'suspend') {
      statusMutation.mutate({ id: confirmAction.user.id, status: 'suspended' })
    } else if (confirmAction.type === 'delete') {
      deleteMutation.mutate(confirmAction.user.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage dealers, agents, and approvals</p>
        </div>
        <TableToolbarSearch className="w-full md:w-72">
          <SearchInput value={search} onChange={setSearch} placeholder="Search users..." />
        </TableToolbarSearch>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <DataTable
              columns={columns}
              data={users}
              exportFilename={`users-${tab.value}.csv`}
              onRowClick={(row) => navigate(`/users/${row.id}`)}
              isLoading={isLoading}
              itemLabel="users"
              emptyTitle="No users found"
              emptyDescription="Try adjusting your search or tab filter."
            />
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmModal
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
        title={confirmAction?.type === 'delete' ? 'Delete User' : 'Suspend User'}
        description={`Are you sure you want to ${confirmAction?.type} ${confirmAction?.user?.name}? This action will be logged.`}
        confirmLabel={confirmAction?.type === 'delete' ? 'Delete' : 'Suspend'}
        variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
        onConfirm={handleConfirm}
        loading={statusMutation.isPending || deleteMutation.isPending}
      />
    </div>
  )
}
