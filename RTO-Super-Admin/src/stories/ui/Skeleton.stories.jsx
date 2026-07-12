import { Skeleton } from '@/components/ui/skeleton'

const meta = { title: 'UI/Skeleton', component: Skeleton, tags: ['autodocs'], parameters: { layout: 'padded' } }
export default meta

export const Default = { render: () => <Skeleton className="h-4 w-48" /> }
export const Card = {
  render: () => (
    <div className="space-y-3 w-72">
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  ),
}
