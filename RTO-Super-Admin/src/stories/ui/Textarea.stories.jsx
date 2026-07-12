import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { componentDocs } from '../helpers/storyMeta'

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: componentDocs({
    description: 'Multi-line text input — min-h-80px, rounded-lg, border-border, focus ring-2. Mirrors Input styling.',
    usage: 'Use for addresses and longer free text. Pair with Label in a space-y-2 wrapper; show errors as text-sm text-destructive below.',
    a11y: 'Always associate with Label via htmlFor/id.',
  }),
}
export default meta

export const Default = { args: { placeholder: 'Enter address...' } }
export const WithLabel = {
  render: () => (
    <div className="space-y-2 w-80">
      <Label htmlFor="address">Address</Label>
      <Textarea id="address" placeholder="House no, street, area, landmark" />
    </div>
  ),
}
export const Disabled = { args: { placeholder: 'Disabled', disabled: true } }
