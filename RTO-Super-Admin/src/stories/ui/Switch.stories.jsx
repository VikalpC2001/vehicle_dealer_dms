import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

const meta = { title: 'UI/Switch', component: Switch, tags: ['autodocs'] }
export default meta

export const Default = { render: () => <Switch /> }
export const Checked = { render: () => <Switch defaultChecked /> }
export const WithLabel = {
  render: () => (
    <div className="flex items-center justify-between w-72">
      <Label htmlFor="notifications">Email Notifications</Label>
      <Switch id="notifications" />
    </div>
  ),
}
