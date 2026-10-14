import { cn } from '@/lib/utils'

/**
 * An agent's own (kanban) status for a job, as a pill. The agent's colour goes on the border and
 * the dot only; the text keeps the normal foreground colour, so the name stays readable whatever
 * colour the agent picked (the default "In Progress" is yellow, which cannot be read as text on a
 * white card). Renders nothing when there is no status: the caller decides what to show instead.
 *
 * @param {object} props
 * @param {{ statusName: string, colour?: string|null }|null} [props.status]
 * @param {string} [props.className]
 */
export function AgentStatusPill({ status, className }) {
  if (!status) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-foreground',
        className
      )}
      style={status.colour ? { borderColor: status.colour } : undefined}
    >
      {status.colour && (
        <span className="h-2 w-2 shrink-0 rounded-full border border-border" style={{ backgroundColor: status.colour }} />
      )}
      {status.statusName}
    </span>
  )
}
