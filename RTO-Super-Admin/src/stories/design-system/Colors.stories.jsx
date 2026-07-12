/** @type { import('@storybook/react-vite').Meta } */
const meta = {
  title: 'Design System/Colors',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Semantic color tokens from `src/index.css`. Use Tailwind classes — never hardcode hex in components.',
      },
    },
  },
}
export default meta

const swatches = [
  { name: 'Background', class: 'bg-background', text: 'text-foreground', token: '#F8FAFC' },
  { name: 'Foreground', class: 'bg-foreground', text: 'text-background', token: '#0F172A' },
  { name: 'Card', class: 'bg-card border border-border', text: 'text-card-foreground', token: '#FFFFFF' },
  { name: 'Border', class: 'bg-border', text: 'text-foreground', token: '#E2E8F0' },
  { name: 'Muted', class: 'bg-muted', text: 'text-muted-foreground', token: '#F1F5F9' },
  { name: 'Primary', class: 'bg-primary', text: 'text-primary-foreground', token: '#2563EB' },
  { name: 'Accent', class: 'bg-accent', text: 'text-white', token: '#3B82F6' },
  { name: 'Success', class: 'bg-success', text: 'text-white', token: '#10B981' },
  { name: 'Warning', class: 'bg-warning', text: 'text-white', token: '#F59E0B' },
  { name: 'Destructive', class: 'bg-destructive', text: 'text-white', token: '#EF4444' },
]

const gradients = [
  { name: 'Accent Gradient', class: 'gradient-bg', usage: 'Buttons, active nav, KPI icons, progress fill' },
]

export const SemanticColors = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full max-w-5xl">
      {swatches.map((s) => (
        <div key={s.name} className={`rounded-xl p-4 ${s.class} ${s.text}`}>
          <p className="font-bold text-sm">{s.name}</p>
          <p className="text-xs opacity-80 mt-1">{s.token}</p>
        </div>
      ))}
    </div>
  ),
}

export const Gradients = {
  render: () => (
    <div className="space-y-4 w-full max-w-2xl">
      {gradients.map((g) => (
        <div key={g.name} className={`rounded-xl p-8 text-white ${g.class}`}>
          <p className="font-bold">{g.name}</p>
          <p className="text-sm text-white/80 mt-1">{g.usage}</p>
          <p className="text-xs mt-2 font-mono">135deg #2563EB → #3B82F6 → #60A5FA</p>
        </div>
      ))}
      <p className="text-4xl font-bold gradient-text">Gradient Text Sample</p>
    </div>
  ),
}

export const StatusTints = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {[
        'bg-success/10 text-success border border-success/20',
        'bg-warning/10 text-warning border border-warning/20',
        'bg-destructive/10 text-destructive border border-destructive/20',
        'bg-primary/10 text-primary border border-primary/20',
      ].map((cls) => (
        <span key={cls} className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${cls}`}>status</span>
      ))}
    </div>
  ),
}
