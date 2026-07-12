import { Store, UserCheck, CreditCard, Clock } from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'

const meta = { title: 'Dashboard/StatCard', component: StatCard, tags: ['autodocs'], parameters: { layout: 'padded' } }
export default meta

export const PositiveGrowth = {
  args: { title: 'Total Dealers', value: 342, growth: 12.5, icon: Store, index: 0 },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
}

export const NegativeGrowth = {
  args: { title: 'Pending Requests', value: 23, growth: -4.1, icon: Clock, index: 1 },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
}

export const Grid = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
      <StatCard title="Total Dealers" value={342} growth={12.5} icon={Store} index={0} />
      <StatCard title="Total Agents" value={518} growth={8.3} icon={UserCheck} index={1} />
      <StatCard title="Active Subscriptions" value={756} growth={15.2} icon={CreditCard} index={2} />
      <StatCard title="Pending Requests" value={23} growth={-4.1} icon={Clock} index={3} />
    </div>
  ),
  parameters: { layout: 'padded' },
}
