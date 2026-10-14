import { AgentStatusPill } from '@/components/vehicle-process/AgentStatusPill'

const meta = {
  title: 'Vehicle Process/AgentStatusPill',
  component: AgentStatusPill,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta

export const Default = { args: { status: { statusName: 'In RTO', colour: '#F59E0B' } } }

/** The six statuses every new agent starts with: yellow and orange must stay readable. */
export const DefaultBoard = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {[
        ['To-Do', 'blue'],
        ['In Progress', 'yellow'],
        ['Inward', 'purple'],
        ['Pending', 'orange'],
        ['Query', 'red'],
        ['Complete', 'green'],
      ].map(([statusName, colour]) => (
        <AgentStatusPill key={statusName} status={{ statusName, colour }} />
      ))}
    </div>
  ),
}

export const NoColour = { args: { status: { statusName: 'Docs received', colour: null } } }
