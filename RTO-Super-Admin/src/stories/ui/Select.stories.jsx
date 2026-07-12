import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const meta = { title: 'UI/Select', tags: ['autodocs'] }
export default meta

export const Default = {
  render: () => (
    <div className="space-y-2 w-72">
      <Label>Role</Label>
      <Select>
        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="dealer">Dealer</SelectItem>
          <SelectItem value="agent">Agent</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}
