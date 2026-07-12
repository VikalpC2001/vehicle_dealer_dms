import { DealerGrowthChart } from '@/components/charts/DealerGrowthChart'
import { AgentGrowthChart } from '@/components/charts/AgentGrowthChart'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { RegistrationChart } from '@/components/charts/RegistrationChart'
import { dealerGrowthData, agentGrowthData, revenueData, registrationData } from '@/data/mockData'

const meta = {
  title: 'Charts/Analytics',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta

export const DealerGrowth = {
  render: () => <div className="w-full max-w-xl"><DealerGrowthChart data={dealerGrowthData} /></div>,
}

export const AgentGrowth = {
  render: () => <div className="w-full max-w-xl"><AgentGrowthChart data={agentGrowthData} /></div>,
}

export const Revenue = {
  render: () => <div className="w-full max-w-xl"><RevenueChart data={revenueData} /></div>,
}

export const Registrations = {
  render: () => <div className="w-full max-w-xl"><RegistrationChart data={registrationData} /></div>,
}

export const DashboardGrid = {
  render: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl">
      <DealerGrowthChart data={dealerGrowthData} />
      <AgentGrowthChart data={agentGrowthData} />
      <RevenueChart data={revenueData} />
      <RegistrationChart data={registrationData} />
    </div>
  ),
}
