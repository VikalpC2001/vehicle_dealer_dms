import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const meta = { title: 'UI/Checkbox', component: Checkbox, tags: ['autodocs'] }
export default meta

export const Default = { render: () => <Checkbox /> }
export const Checked = { render: () => <Checkbox defaultChecked /> }
export const WithLabel = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="remember" />
      <Label htmlFor="remember" className="font-normal cursor-pointer">Remember me</Label>
    </div>
  ),
}
export const Disabled = { render: () => <Checkbox disabled /> }
