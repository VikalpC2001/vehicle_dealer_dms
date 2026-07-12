import { Badge } from '@/components/ui/badge'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: { variant: { control: 'select', options: ['default', 'secondary', 'outline', 'success', 'warning', 'destructive'] } },
}
export default meta

export const Default = { args: { children: 'Badge', variant: 'default' } }
export const Secondary = { args: { children: 'dealer', variant: 'secondary' } }
export const Success = { args: { children: 'active', variant: 'success' } }
export const Warning = { args: { children: 'pending', variant: 'warning' } }
export const Destructive = { args: { children: 'suspended', variant: 'destructive' } }
export const AllVariants = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {['default', 'secondary', 'outline', 'success', 'warning', 'destructive'].map((v) => (
        <Badge key={v} variant={v}>{v}</Badge>
      ))}
    </div>
  ),
}
