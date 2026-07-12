import { formatDate } from '@/lib/utils'

/**
 * Draggable process card for the Kanban board.
 *
 * @param {object} props
 * @param {object} props.process
 * @param {(e: DragEvent, process: object) => void} props.onDragStart
 * @param {(process: object) => void} [props.onClick]
 */
export function ProcessCard({ process, onDragStart, onClick }) {
  const reg = process?.vehicle?.registrationNumber ?? process?.registrationNumber ?? 'Vehicle process'
  const seller = (process?.persons ?? []).find((p) => p.personType === 'SELLER')?.personName

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, process)}
      onClick={() => onClick?.(process)}
      className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <p className="text-sm font-semibold">{reg}</p>
      {seller && <p className="truncate text-xs text-muted-foreground">{seller}</p>}
      {process?.processDate && (
        <p className="mt-1 text-xs text-muted-foreground">{formatDate(process.processDate)}</p>
      )}
    </div>
  )
}
