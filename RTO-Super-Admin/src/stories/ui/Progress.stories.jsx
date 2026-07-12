import { Progress } from '@/components/ui/progress'

const meta = { title: 'UI/Progress', component: Progress, tags: ['autodocs'], parameters: { layout: 'padded' } }
export default meta

export const Empty = { args: { value: 0, className: 'w-72' } }
export const Half = { args: { value: 50, className: 'w-72' } }
export const Full = { args: { value: 100, className: 'w-72' } }
export const Subscription = {
  render: () => (
    <div className="w-72 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subscription Progress</span>
        <span className="font-medium">75%</span>
      </div>
      <Progress value={75} />
    </div>
  ),
}
