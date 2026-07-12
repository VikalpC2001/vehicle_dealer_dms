import { useState } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { mockUsers } from '@/data/mockData'
import { formatDate } from '@/lib/utils'
import { componentDocs } from '@/stories/helpers/storyMeta'
import { PAGE_SIZE } from '@/lib/pagination'

const meta = {
  title: 'Tables/DataTable',
  component: DataTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    ...componentDocs({
      description: 'Unified data table supporting client-side and server-side pagination, sorting, export, and row selection.',
      usage: 'Use mode="client" for mock/filtered data. Use mode="server" with page, totalPages, onPageChange for API lists.',
    }),
  },
}
export default meta

const columns = [
  { key: 'name', label: 'User Name', sortable: true },
  {
    key: 'role',
    label: 'Role',
    sortable: true,
    render: (row) => <Badge variant="secondary" className="capitalize">{row.role}</Badge>,
  },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'plan', label: 'Plan', sortable: true },
  {
    key: 'registrationDate',
    label: 'Date',
    sortable: true,
    render: (row) => formatDate(row.registrationDate),
  },
  { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
]

export const ClientDefault = {
  name: 'Client — Default',
  render: () => (
    <DataTable columns={columns} data={mockUsers} exportFilename="users.csv" itemLabel="users" />
  ),
}

export const ClientWithPagination = {
  name: 'Client — Pagination',
  render: () => (
    <DataTable
      columns={columns}
      data={[...mockUsers, ...mockUsers, ...mockUsers]}
      pageSize={5}
      itemLabel="users"
    />
  ),
}

export const Empty = {
  render: () => (
    <DataTable
      columns={columns}
      data={[]}
      emptyTitle="No users found"
      emptyDescription="Try adjusting your search or filters."
    />
  ),
}

export const Loading = {
  render: () => <DataTable columns={columns} data={[]} isLoading />,
}

export const ServerMode = {
  name: 'Server — Paginated',
  render: function Render() {
    const [page, setPage] = useState(1)
    const pageSize = PAGE_SIZE.crud
    const allData = mockUsers
    const total = allData.length
    const totalPages = Math.ceil(total / pageSize)
    const slice = allData.slice((page - 1) * pageSize, page * pageSize)

    return (
      <DataTable
        mode="server"
        columns={columns}
        data={slice}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        itemLabel="users"
        showExport={false}
        selectable={false}
      />
    )
  },
}

export const ServerUpdating = {
  name: 'Server — Fetching',
  render: () => (
    <DataTable
      mode="server"
      columns={columns}
      data={mockUsers.slice(0, 5)}
      page={1}
      totalPages={3}
      total={15}
      pageSize={5}
      onPageChange={() => {}}
      isFetching
      itemLabel="dealers"
      showExport={false}
      selectable={false}
    />
  ),
}

export const WithoutSelection = {
  name: 'Variant — No Checkboxes',
  render: () => (
    <DataTable
      columns={columns}
      data={mockUsers}
      selectable={false}
      showExport={false}
      itemLabel="users"
    />
  ),
}
