import { DataTable } from '@/components/tables/DataTable'
import { TableContainer } from '@/components/tables/TableContainer'
import { TablePagination } from '@/components/tables/TablePagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'
import { useState } from 'react'

const meta = {
  title: 'Tables/TableVariants',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta

const dealerColumns = [
  { key: 'firmName', label: 'Firm Name', render: (row) => <span className="font-semibold">{row.firmName}</span> },
  { key: 'city', label: 'City' },
  { key: 'mobileNo', label: 'Mobile' },
  {
    key: 'isSubscribe',
    label: 'Subscribed',
    render: (row) => <Badge variant={row.isSubscribe ? 'success' : 'secondary'}>{row.isSubscribe ? 'Yes' : 'No'}</Badge>,
  },
  {
    label: 'Actions',
    render: () => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    ),
  },
]

const dealerData = [
  { id: 1, firmName: 'Auto Hub', city: 'Mumbai', mobileNo: '9876543210', isSubscribe: true },
  { id: 2, firmName: 'City Motors', city: 'Pune', mobileNo: '9123456780', isSubscribe: false },
]

export const ServerCrudTable = {
  name: 'Server CRUD (no selection)',
  render: function Render() {
    const [page, setPage] = useState(1)
    return (
      <DataTable
        mode="server"
        columns={dealerColumns}
        data={dealerData}
        page={page}
        totalPages={2}
        total={12}
        pageSize={10}
        onPageChange={setPage}
        itemLabel="dealers"
        showExport={false}
        selectable={false}
      />
    )
  },
}

export const PrimitiveTableInContainer = {
  name: 'Primitive Table + Container',
  render: () => (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>State Name</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-semibold">Maharashtra</TableCell>
            <TableCell>
              <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  ),
}

export const StandalonePagination = {
  name: 'Standalone Pagination Footer',
  render: function Render() {
    const [page, setPage] = useState(2)
    return (
      <TablePagination
        page={page}
        totalPages={4}
        total={38}
        pageSize={10}
        onPageChange={setPage}
        itemLabel="cities"
      />
    )
  },
}
