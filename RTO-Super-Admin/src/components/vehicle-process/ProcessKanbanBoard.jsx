import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ProcessCard } from './ProcessCard'
import { getProcessId } from '@/services/vehicleProcessService'

const UNSORTED = '__unsorted__'

/**
 * Kanban board grouping processes by status. Columns come from the dealer's statuses
 * (ordered); processes whose status matches none go to a non-droppable "Unsorted" column.
 * Drag a card onto a status column to change its status. Native HTML5 DnD (no library).
 *
 * @param {object} props
 * @param {Array} props.processes - Each item includes `status`, `vehicleId`, `processDate`, `persons[]`.
 * @param {Array<{statusId,statusName,colour}>} props.statuses
 * @param {(process: object, newStatusName: string) => void} props.onMove
 * @param {(process: object) => void} [props.onCardClick]
 */
export function ProcessKanbanBoard({ processes, statuses, onMove, onCardClick }) {
  const [dragOverCol, setDragOverCol] = useState(null)

  const names = statuses.map((s) => s.statusName)
  const groups = { [UNSORTED]: [] }
  names.forEach((n) => {
    groups[n] = []
  })
  processes.forEach((p) => {
    const status = (p.status ?? '').trim().toLowerCase()
    const match = names.find((n) => n.toLowerCase() === status)
    groups[match ?? UNSORTED].push(p)
  })

  const handleDragStart = (e, process) => {
    e.dataTransfer.setData('text/plain', getProcessId(process))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e, statusName) => {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('text/plain')
    const process = processes.find((p) => getProcessId(p) === id)
    if (process && statusName && process.status !== statusName) onMove(process, statusName)
  }

  const columns = [
    ...(groups[UNSORTED].length ? [{ key: UNSORTED, name: 'Unsorted', colour: null, droppable: false }] : []),
    ...statuses.map((s) => ({ key: s.statusName, name: s.statusName, colour: s.colour, droppable: true })),
  ]

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.key}
          onDragOver={col.droppable ? (e) => { e.preventDefault(); setDragOverCol(col.key) } : undefined}
          onDragLeave={col.droppable ? () => setDragOverCol(null) : undefined}
          onDrop={col.droppable ? (e) => handleDrop(e, col.name) : undefined}
          className={cn(
            'flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-3',
            dragOverCol === col.key && 'border-primary bg-primary/5'
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {col.colour && (
                <span className="h-2.5 w-2.5 rounded-full border border-border" style={{ backgroundColor: col.colour }} />
              )}
              <h3 className="text-sm font-semibold">{col.name}</h3>
            </div>
            <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
              {groups[col.key].length}
            </span>
          </div>
          <div className="space-y-2">
            {groups[col.key].map((p) => (
              <ProcessCard key={getProcessId(p)} process={p} onDragStart={handleDragStart} onClick={onCardClick} />
            ))}
            {groups[col.key].length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {col.droppable ? 'Drop here' : 'Empty'}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
