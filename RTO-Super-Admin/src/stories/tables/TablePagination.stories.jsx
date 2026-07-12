import { useState } from 'react'
import { TablePagination } from '@/components/tables/TablePagination'
import { componentDocs } from '@/stories/helpers/storyMeta'

const meta = {
  title: 'Tables/TablePagination',
  component: TablePagination,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    ...componentDocs({
      description: 'Standard pagination footer for all data tables. Uses 1-based page indexing.',
      usage: 'Use inside DataTable or standalone on server-paginated lists.',
      a11y: 'Previous/next buttons include aria-labels; page indicator uses aria-live="polite".',
    }),
  },
}
export default meta

export const Default = {
  render: function Render() {
    const [page, setPage] = useState(1)
    return (
      <TablePagination
        page={page}
        totalPages={5}
        total={42}
        pageSize={10}
        onPageChange={setPage}
        itemLabel="dealers"
      />
    )
  },
}

export const FirstPage = {
  args: {
    page: 1,
    totalPages: 3,
    total: 24,
    pageSize: 8,
    onPageChange: () => {},
    itemLabel: 'users',
  },
}

export const LastPage = {
  args: {
    page: 3,
    totalPages: 3,
    total: 24,
    pageSize: 8,
    onPageChange: () => {},
    itemLabel: 'users',
  },
}

export const Updating = {
  args: {
    page: 2,
    totalPages: 4,
    total: 35,
    pageSize: 10,
    onPageChange: () => {},
    isFetching: true,
    itemLabel: 'states',
  },
}

export const HiddenWhenSinglePage = {
  render: () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Pagination is hidden when totalPages ≤ 1 (returns null).
      </p>
      <TablePagination
        page={1}
        totalPages={1}
        total={5}
        pageSize={8}
        onPageChange={() => {}}
        itemLabel="items"
      />
      <p className="text-sm italic text-muted-foreground">Nothing rendered above.</p>
    </div>
  ),
}
