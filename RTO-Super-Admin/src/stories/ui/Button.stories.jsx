import { Button } from '@/components/ui/button'
import { Loader2, Mail } from 'lucide-react'
import { componentDocs } from '../helpers/storyMeta'

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: componentDocs({
    description: 'Primary action component with CVA variants. Default uses blue gradient.',
    usage: 'Use `default` for primary CTAs, `outline` for secondary, `ghost` for icon actions, `destructive` for irreversible actions.',
    a11y: 'Includes focus-visible ring. Minimum height 40px for touch targets.',
  }),
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
    disabled: { control: 'boolean' },
  },
}
export default meta

export const Default = { args: { children: 'Sign In', variant: 'default' } }
export const Destructive = { args: { children: 'Delete', variant: 'destructive' } }
export const Outline = { args: { children: 'Export CSV', variant: 'outline' } }
export const Secondary = { args: { children: 'Secondary', variant: 'secondary' } }
export const Ghost = { args: { children: 'Ghost', variant: 'ghost' } }
export const Link = { args: { children: 'Forgot password?', variant: 'link' } }
export const Small = { args: { children: 'Small', size: 'sm', variant: 'outline' } }
export const Large = { args: { children: 'Sign In', size: 'lg' } }
export const Icon = { args: { children: <Mail className="h-4 w-4" />, size: 'icon', variant: 'outline', 'aria-label': 'Email' } }
export const Disabled = { args: { children: 'Disabled', disabled: true } }
export const Loading = {
  render: () => (
    <Button disabled>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
    </Button>
  ),
}
export const AllVariants = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'].map((v) => (
        <Button key={v} variant={v}>{v}</Button>
      ))}
    </div>
  ),
}
