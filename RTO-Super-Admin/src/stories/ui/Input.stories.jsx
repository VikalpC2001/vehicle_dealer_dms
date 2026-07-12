import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { componentDocs } from '../helpers/storyMeta'

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: componentDocs({
    description: 'Text input — h-10, rounded-lg, border-border, focus ring-2.',
    usage: 'Pair with Label in space-y-2 wrapper. Show errors as text-sm text-destructive below.',
    a11y: 'Always associate with Label via htmlFor/id.',
  }),
}
export default meta

export const Default = { args: { placeholder: 'user@example.com' } }
export const WithLabel = {
  render: () => (
    <div className="space-y-2 w-72">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="user@example.com" />
    </div>
  ),
}
export const Disabled = { args: { placeholder: 'Disabled', disabled: true } }
export const Password = { args: { type: 'password', placeholder: 'Enter password' } }
export const SearchStyle = { args: { placeholder: 'Search...', className: 'pl-9 bg-muted/50 border-0' } }
