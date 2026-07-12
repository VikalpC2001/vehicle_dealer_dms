const meta = {
  title: 'Design System/Spacing',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Tailwind spacing scale. Page rhythm: space-y-6 (standard) or space-y-8 (dashboard). Main padding: p-4 → md:p-6 → lg:p-8.',
      },
    },
  },
}
export default meta

const scale = [
  { token: 'gap-1', px: '4px' },
  { token: 'gap-2', px: '8px' },
  { token: 'gap-3', px: '12px' },
  { token: 'gap-4', px: '16px' },
  { token: 'gap-6', px: '24px' },
  { token: 'gap-8', px: '32px' },
]

const layout = [
  { name: 'Sidebar Width', value: '280px', var: '--sidebar-width' },
  { name: 'Topbar Height', value: '72px', var: '--topbar-height' },
]

export const SpacingScale = {
  render: () => (
    <div className="space-y-3 w-full max-w-md">
      {scale.map((s) => (
        <div key={s.token} className="flex items-center gap-4">
          <span className="w-16 text-xs font-mono text-muted-foreground">{s.token}</span>
          <div className={`h-4 bg-primary rounded ${s.token === 'gap-1' ? 'w-1' : ''}`} style={{ width: s.px }} />
          <span className="text-xs text-muted-foreground">{s.px}</span>
        </div>
      ))}
    </div>
  ),
}

export const LayoutConstants = {
  render: () => (
    <div className="space-y-4">
      {layout.map((l) => (
        <div key={l.name} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
          <div className="h-2 gradient-bg rounded" style={{ width: l.value }} />
          <div>
            <p className="font-bold text-sm">{l.name}</p>
            <p className="text-xs text-muted-foreground">{l.value} · {l.var}</p>
          </div>
        </div>
      ))}
    </div>
  ),
}

export const CardPadding = {
  render: () => (
    <div className="rounded-xl border border-border bg-card p-6 w-64">
      <p className="text-sm font-bold">Card padding: p-6 (24px)</p>
      <p className="text-xs text-muted-foreground mt-2">CardContent uses p-6 pt-0 when following CardHeader</p>
    </div>
  ),
}
