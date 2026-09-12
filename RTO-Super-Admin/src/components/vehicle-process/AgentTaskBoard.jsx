import { useState } from 'react'
import { Building2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TagChip } from '@/components/vehicle-process/TagChip'

/**
 * A unified card on the agent board. `kind` distinguishes dealer-assigned work from the agent's own
 * (agent-created) processes; the colored tag reflects it.
 * @typedef {object} AgentBoardCard
 * @property {'assigned'|'own'} kind
 * @property {string} key - stable unique id (`a:<assignmentId>` / `p:<processId>`)
 * @property {string} id - assignmentId (assigned) or processId (own)
 * @property {string|null} agentStatusId - current kanban column
 * @property {string} [vehicleReg]
 * @property {string} [dealerName]
 * @property {string} [serviceName]
 * @property {Array<{tagId:string, tagName:string, colour?:string}>} [tags] - the process's Finder tags
 */

/** One draggable card, with a colored tag differentiating dealer-assigned vs agent-created work. */
function AgentTaskCard({ card, onDragStart, onClick }) {
  const isAssigned = card.kind === 'assigned'
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onClick={() => onClick?.(card)}
      className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold">{card.vehicleReg || 'Vehicle process'}</p>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
            isAssigned
              ? 'border-primary/20 bg-primary/10 text-primary'
              : 'border-warning/20 bg-warning/10 text-warning'
          )}
        >
          {isAssigned ? 'Assigned' : 'Own'}
        </span>
      </div>
      {Array.isArray(card.tags) && card.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.tags.map((t) => (
            <TagChip key={t.tagId} name={t.tagName} colour={t.colour} />
          ))}
        </div>
      )}
      {card.dealerName && (
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" /> {card.dealerName}
        </p>
      )}
      {card.serviceName && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Wrench className="h-3 w-3 shrink-0" /> {card.serviceName}
        </p>
      )}
    </div>
  )
}

/**
 * Agent kanban board. Columns are the agent's own `AgentStatus` rows (rank order); cards are the
 * unified dealer-assigned + agent-created list, grouped by `agentStatusId`. Cards with no (or an
 * unknown) status fall into the first column. Drag a card onto a column to move it. Native HTML5 DnD.
 *
 * @param {object} props
 * @param {AgentBoardCard[]} props.cards
 * @param {Array<{statusId,statusName,colour}>} props.statuses
 * @param {(card: AgentBoardCard, newStatusId: string) => void} props.onMove
 * @param {(card: AgentBoardCard) => void} [props.onCardClick]
 */
export function AgentTaskBoard({ cards, statuses, onMove, onCardClick }) {
  const [dragOverCol, setDragOverCol] = useState(null)

  if (!statuses.length) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Add statuses under Settings → Statuses to use the board.
      </p>
    )
  }

  const firstStatusId = statuses[0].statusId
  const groups = {}
  statuses.forEach((s) => {
    groups[s.statusId] = []
  })
  cards.forEach((c) => {
    const key = c.agentStatusId && groups[c.agentStatusId] ? c.agentStatusId : firstStatusId
    groups[key].push(c)
  })

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('text/plain', card.key)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e, statusId) => {
    e.preventDefault()
    setDragOverCol(null)
    const key = e.dataTransfer.getData('text/plain')
    const card = cards.find((c) => c.key === key)
    // The current column is the effective one (nulls sit in the first column), so guard against it.
    const currentCol = card?.agentStatusId && groups[card.agentStatusId] ? card.agentStatusId : firstStatusId
    if (card && statusId && currentCol !== statusId) onMove(card, statusId)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statuses.map((col) => (
        <div
          key={col.statusId}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverCol(col.statusId)
          }}
          onDragLeave={() => setDragOverCol(null)}
          onDrop={(e) => handleDrop(e, col.statusId)}
          className={cn(
            'flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-3',
            dragOverCol === col.statusId && 'border-primary bg-primary/5'
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {col.colour && (
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border"
                  style={{ backgroundColor: col.colour }}
                />
              )}
              <h3 className="text-sm font-semibold">{col.statusName}</h3>
            </div>
            <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
              {groups[col.statusId].length}
            </span>
          </div>
          <div className="space-y-2">
            {groups[col.statusId].map((card) => (
              <AgentTaskCard key={card.key} card={card} onDragStart={handleDragStart} onClick={onCardClick} />
            ))}
            {groups[col.statusId].length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Drop here</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
