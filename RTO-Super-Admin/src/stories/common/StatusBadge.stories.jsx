import { StatusBadge } from '@/components/common/StatusBadge'

const meta = { title: 'Common/StatusBadge', component: StatusBadge, tags: ['autodocs'] }
export default meta

export const Active = { args: { status: 'active' } }
export const Pending = { args: { status: 'pending' } }
export const Suspended = { args: { status: 'suspended' } }
export const InProgress = { args: { status: 'in_progress' } }
export const Urgent = { args: { status: 'urgent' } }
export const AllStatuses = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {['active', 'pending', 'suspended', 'approved', 'rejected', 'in_progress', 'expiring', 'expired', 'low', 'medium', 'high', 'urgent'].map((s) => (
        <StatusBadge key={s} status={s} />
      ))}
    </div>
  ),
}
