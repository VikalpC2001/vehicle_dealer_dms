import { useState } from 'react'
import { SearchInput } from '@/components/common/SearchInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  TableToolbar,
  TableToolbarSearch,
  TableToolbarFilters,
  TableToolbarActions,
} from '@/components/tables/TableToolbar'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { componentDocs } from '@/stories/helpers/storyMeta'

const meta = {
  title: 'Tables/SearchFilters',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    ...componentDocs({
      description: 'Standard list-page toolbar pattern: search, filters, and primary actions.',
      usage: 'Compose TableToolbar with Search, Filters, and Actions slots above DataTable.',
    }),
  },
}
export default meta

export const SearchAndStatusFilter = {
  name: 'Search + Select Filter',
  render: function Render() {
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')

    return (
      <TableToolbar>
        <TableToolbarSearch>
          <SearchInput value={search} onChange={setSearch} placeholder="Search requests..." />
        </TableToolbarSearch>
        <TableToolbarFilters>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </TableToolbarFilters>
      </TableToolbar>
    )
  },
}

export const FilterWithAction = {
  name: 'Filter + Add Action',
  render: function Render() {
    const [stateId, setStateId] = useState('1')

    return (
      <TableToolbar>
        <TableToolbarFilters>
          <div className="space-y-2 w-full sm:w-72">
            <Label>Filter by State</Label>
            <Select value={stateId} onValueChange={setStateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Maharashtra</SelectItem>
                <SelectItem value="2">Karnataka</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TableToolbarFilters>
        <TableToolbarActions>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add City
          </Button>
        </TableToolbarActions>
      </TableToolbar>
    )
  },
}

export const SearchOnly = {
  render: function Render() {
    const [search, setSearch] = useState('')
    return (
      <TableToolbar>
        <TableToolbarSearch className="sm:max-w-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Search users..." />
        </TableToolbarSearch>
      </TableToolbar>
    )
  },
}
