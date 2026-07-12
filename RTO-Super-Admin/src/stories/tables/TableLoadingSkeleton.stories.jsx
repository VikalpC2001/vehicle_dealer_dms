import { TableLoadingSkeleton } from '@/components/tables/TableLoadingSkeleton'
import { componentDocs } from '@/stories/helpers/storyMeta'

const meta = {
  title: 'Tables/TableLoadingSkeleton',
  component: TableLoadingSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    ...componentDocs({
      description: 'Standard skeleton placeholder while table data is loading.',
      usage: 'Used automatically by DataTable when isLoading=true. Use directly on list pages without tables.',
    }),
  },
}
export default meta

export const Default = {
  args: { rows: 5 },
}

export const Compact = {
  args: { rows: 3, rowClassName: 'h-10' },
}

export const DealerRows = {
  name: 'Dealer List (taller rows)',
  args: { rows: 5, rowClassName: 'h-14' },
}
