import { PageTransition } from '@/components/common/PageTransition'

const meta = { title: 'Common/PageTransition', tags: ['autodocs'], parameters: { layout: 'padded' } }
export default meta

export const Default = {
  render: () => (
    <PageTransition>
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="font-bold">Page content with fade-in animation</p>
        <p className="text-sm text-muted-foreground mt-1">opacity 0→1, y 12→0 over 300ms</p>
      </div>
    </PageTransition>
  ),
}
