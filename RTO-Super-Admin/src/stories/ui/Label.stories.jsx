import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

const meta = { title: 'UI/Label', component: Label, tags: ['autodocs'] }
export default meta

export const Default = { args: { children: 'Email' } }
export const WithInput = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="field">Full Name</Label>
      <Input id="field" placeholder="John Doe" />
    </div>
  ),
}
