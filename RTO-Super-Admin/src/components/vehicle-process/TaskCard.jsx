import { User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { TagChip } from './TagChip'

/**
 * Draggable task card for the Task Board. Shows the job, the vehicle, the vehicle's tags, the
 * assignee, and the due date.
 *
 * @param {object} props
 * @param {object} props.card - Board task { processTaskId, taskName, taskDate, assignUserName,
 *   vehicleRegistrationNumber, tags: [{tagId,tagName,colour}], ... }.
 * @param {(e: DragEvent, card: object) => void} props.onDragStart
 * @param {(card: object) => void} [props.onClick]
 */
export function TaskCard({ card, onDragStart, onClick }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onClick={() => onClick?.(card)}
      className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <p className="text-sm font-semibold">{card.taskName}</p>
      {card.vehicleRegistrationNumber && (
        <p className="truncate text-xs text-muted-foreground">{card.vehicleRegistrationNumber}</p>
      )}

      {Array.isArray(card.tags) && card.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.tags.map((t) => (
            <TagChip key={t.tagId} name={t.tagName} colour={t.colour} />
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{card.assignUserName || 'Unassigned'}</span>
        </span>
        {card.taskDate && <span className="shrink-0">{formatDate(card.taskDate)}</span>}
      </div>
    </div>
  )
}
