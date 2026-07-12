import { Separator } from '@/components/ui/separator'

const meta = { title: 'UI/Separator', component: Separator, tags: ['autodocs'], parameters: { layout: 'padded' } }
export default meta

export const Horizontal = {
  render: () => (
    <div className="w-72 space-y-4">
      <p className="text-sm">Above</p>
      <Separator />
      <p className="text-sm">Below</p>
    </div>
  ),
}

export const Vertical = {
  render: () => (
    <div className="flex h-8 items-center gap-4">
      <span className="text-sm">Left</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Right</span>
    </div>
  ),
}
