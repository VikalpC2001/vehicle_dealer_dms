import { EmptyState } from '@/components/common/EmptyState'
import { componentDocs } from '@/stories/helpers/storyMeta'

const meta = {
  title: 'Common/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    ...componentDocs({
      description: 'Standard empty state for tables and list pages when no data matches filters.',
      usage: 'Pass custom title and description. DataTable accepts emptyTitle and emptyDescription props.',
    }),
  },
}
export default meta

export const Default = { args: {} }

export const TableSearchEmpty = {
  name: 'Filtered Table',
  args: {
    title: 'No users found',
    description: 'Try adjusting your search or tab filter.',
  },
}

export const CrudEmpty = {
  name: 'CRUD — First Record',
  args: {
    title: 'No dealers found',
    description: 'Add your first dealer to get started.',
  },
}

export const LocationEmpty = {
  name: 'Dependency Missing',
  args: {
    title: 'No states available',
    description: 'Add states first before managing cities.',
  },
}
