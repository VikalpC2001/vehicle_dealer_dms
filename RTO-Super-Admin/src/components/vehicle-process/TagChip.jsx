import { cn } from '@/lib/utils'

/**
 * A small pill rendering a tag as a colored label (macOS Finder-style). The dot uses the dealer's
 * configured tag colour; when no colour is known it falls back to a plain muted pill.
 *
 * @param {object} props
 * @param {string} [props.name] - Tag name; renders an em-dash when empty.
 * @param {string|null} [props.colour] - Dealer tag colour (hex) for the dot; null = muted.
 * @param {string} [props.className]
 */
export function TagChip({ name, colour, className }) {
  if (!name) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        colour ? 'border-border text-foreground' : 'border-border bg-muted text-muted-foreground',
        className
      )}
    >
      {colour && (
        <span className="h-2 w-2 rounded-full border border-border" style={{ backgroundColor: colour }} />
      )}
      {name}
    </span>
  )
}
