const meta = {
  title: 'Design System/Typography',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Inter font family. Headings use font-bold (700). Body uses font-medium (500).',
      },
    },
  },
}
export default meta

const samples = [
  { label: 'H1 / Display', class: 'text-3xl font-bold', size: '36px', sample: 'Welcome Back, Super Admin' },
  { label: 'H2', class: 'text-2xl font-bold', size: '30px', sample: 'User Management' },
  { label: 'H3', class: 'text-xl font-bold', size: '24px', sample: 'Regional Transport Office' },
  { label: 'Card Title', class: 'text-lg font-bold', size: '18px', sample: 'Recent Activity' },
  { label: 'Card Title Compact', class: 'text-base font-bold', size: '16px', sample: 'Dealer Growth' },
  { label: 'Body', class: 'text-sm font-medium', size: '14px', sample: 'Manage dealers, agents, and approvals' },
  { label: 'Caption', class: 'text-xs text-muted-foreground', size: '12px', sample: 'Joined 15 Jan 2024' },
  { label: 'KPI Value', class: 'text-3xl font-bold tracking-tight', size: '30px', sample: '342' },
]

export const TypeScale = {
  render: () => (
    <div className="space-y-8 w-full max-w-3xl">
      {samples.map((s) => (
        <div key={s.label} className="border-b border-border pb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{s.label}</span>
            <span className="font-mono">{s.size} · {s.class}</span>
          </div>
          <p className={s.class}>{s.sample}</p>
        </div>
      ))}
    </div>
  ),
}

export const TextColors = {
  render: () => (
    <div className="space-y-2">
      <p className="text-foreground font-medium">text-foreground — Primary content</p>
      <p className="text-muted-foreground font-medium">text-muted-foreground — Secondary</p>
      <p className="text-primary font-medium">text-primary — Links & actions</p>
      <p className="text-success font-medium">text-success — Positive metrics</p>
      <p className="text-destructive font-medium">text-destructive — Errors</p>
    </div>
  ),
}
