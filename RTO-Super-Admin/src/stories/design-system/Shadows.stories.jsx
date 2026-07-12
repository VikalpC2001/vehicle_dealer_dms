const meta = {
  title: 'Design System/Shadows',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Restrained elevation. Never stack multiple shadow layers. Cards are flat at rest, elevate on hover.',
      },
    },
  },
}
export default meta

const levels = [
  { name: 'None', class: '', usage: 'Default card at rest' },
  { name: 'shadow-sm', class: 'shadow-sm', usage: 'Cards, active nav item' },
  { name: 'shadow-md', class: 'shadow-md', usage: 'Hover cards, dropdowns' },
  { name: 'shadow-lg', class: 'shadow-lg', usage: 'Toasts' },
  { name: 'shadow-xl', class: 'shadow-xl', usage: 'Dialog content' },
]

export const ShadowLevels = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
      {levels.map((l) => (
        <div key={l.name} className={`rounded-xl border border-border bg-card p-6 ${l.class}`}>
          <p className="font-bold text-sm">{l.name}</p>
          <p className="text-xs text-muted-foreground mt-2">{l.usage}</p>
        </div>
      ))}
    </div>
  ),
}

export const HoverElevation = {
  render: () => (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md w-64 cursor-pointer">
      <p className="font-bold text-sm">Hover me</p>
      <p className="text-xs text-muted-foreground mt-1">transition-shadow hover:shadow-md</p>
    </div>
  ),
}
