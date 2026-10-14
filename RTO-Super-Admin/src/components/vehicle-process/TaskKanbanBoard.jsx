import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskCard } from './TaskCard'

const UNSORTED = '__unsorted__'

/**
 * Kanban board grouping tasks by their task-board status — one droppable column per status (ordered
 * by statusRank), including the DONE column(s) which hold the completed tasks. A card can be dragged
 * between ANY columns, including moving a completed task back to an open status (the backend clears
 * its completion). Tasks whose status matches no column fall into a non-droppable "Unsorted" column
 * at the end. Dropping a card on a status column calls `onMove(card, statusName)`. Native HTML5 DnD.
 *
 * @param {object} props
 * @param {Array} props.tasks - Board tasks (see processTaskService.getBoard).
 * @param {Array<{statusId,statusName,colour,statusRank,isDone}>} props.statuses - Task-board columns.
 * @param {(card: object, newStatusName: string) => void} props.onMove
 * @param {(card: object) => void} [props.onCardClick]
 */
export function TaskKanbanBoard({ tasks, statuses, onMove, onCardClick }) {
  const [dragOverCol, setDragOverCol] = useState(null)

  const names = statuses.map((s) => s.statusName)
  const groups = { [UNSORTED]: [] }
  names.forEach((n) => {
    groups[n] = []
  })
  // Bucket every task — open OR completed — into its own status column, so completed tasks live in
  // the DONE column and can be dragged back out, not stranded in a separate read-only lane.
  tasks.forEach((t) => {
    const status = (t.status ?? '').trim().toLowerCase()
    const match = names.find((n) => n.toLowerCase() === status)
    groups[match ?? UNSORTED].push(t)
  })

  // Completed (DONE) columns are ordered by completion date — most recently completed first — so the
  // done pile reads as a clean chronological sequence instead of board/creation order.
  statuses.forEach((s) => {
    if (s.isDone && groups[s.statusName]) {
      groups[s.statusName].sort((a, b) => {
        const at = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return bt - at
      })
    }
  })

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('text/plain', card.processTaskId)
    e.dataTransfer.effectAllowed = 'move'
    // Use the card element itself as the drag image so the dragged ghost keeps its rounded corners and
    // styling (the browser's default drag image can render the card as a square box).
    try {
      e.dataTransfer.setDragImage(e.currentTarget, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
    } catch {
      /* setDragImage unsupported — fall back to the default drag image */
    }
  }

  const handleDrop = (e, statusName) => {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('text/plain')
    const card = tasks.find((t) => t.processTaskId === id)
    // Allow moving a task to ANY status — including a completed task back to an open one.
    if (card && statusName && card.status !== statusName) onMove(card, statusName)
  }

  const columns = [
    ...statuses.map((s) => ({
      key: s.statusName,
      name: s.statusName,
      colour: s.colour,
      droppable: true,
      done: s.isDone,
    })),
    ...(groups[UNSORTED].length
      ? [{ key: UNSORTED, name: 'Unsorted', colour: null, droppable: false }]
      : []),
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
            // Columns flex to fill the whole screen width; min-width keeps them usable and lets the row
            // scroll horizontally only when there are too many statuses to fit.
            'flex min-w-[15rem] flex-1 flex-col rounded-xl border border-border bg-muted/30 p-3',
            dragOverCol === col.key && 'border-primary bg-primary/5'
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {col.done && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
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
            {groups[col.key].map((t) => (
              <TaskCard
                key={t.processTaskId}
                card={t}
                onDragStart={handleDragStart}
                onClick={onCardClick}
              />
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
