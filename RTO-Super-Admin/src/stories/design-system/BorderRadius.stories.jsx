const meta = {
  title: 'Design System/Border Radius',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta

const radii = [
  { name: 'sm (md)', class: 'rounded-md', value: '6px', usage: 'Small buttons, tab triggers' },
  { name: 'md (lg)', class: 'rounded-lg', value: '8px', usage: 'Buttons, inputs, nav items, toasts' },
  { name: 'lg (xl)', class: 'rounded-xl', value: '12px', usage: 'Cards, tables, modals, KPI icons' },
  { name: 'full', class: 'rounded-full', value: '50%', usage: 'Avatars, badges, count pills' },
]

export const RadiusScale = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {radii.map((r) => (
        <div key={r.name} className="text-center">
          <div className={`h-20 w-20 mx-auto bg-primary ${r.class}`} />
          <p className="font-bold text-sm mt-3">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{r.usage}</p>
        </div>
      ))}
    </div>
  ),
}
