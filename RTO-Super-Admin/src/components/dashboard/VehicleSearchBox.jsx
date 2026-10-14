import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { processAssignmentService } from '@/services/processAssignmentService'
import { PROCESS_STATUS_LABEL, PROCESS_STATUS_COLOUR } from '@/lib/processStatus'
import { cn } from '@/lib/utils'

const MAX_RESULTS = 8

/** A dealer's process row → one search result. */
function dealerProcessToResult(p) {
  const id = getProcessId(p)
  return {
    key: `d:${id}`,
    title: p.vehicle?.registrationNumber ?? p.registrationNumber ?? 'Vehicle process',
    subline: [p.vehicle?.model, p.vehicle?.manufactureYear].filter(Boolean).join(' · '),
    status: p.status ? { label: PROCESS_STATUS_LABEL[p.status], colour: PROCESS_STATUS_COLOUR[p.status] } : null,
    linkTo: id ? `/dealer/processes/${id}` : null,
  }
}

/** An agent's dealer-assigned job → one search result (opens the assignment). */
function assignmentToResult(a) {
  const dealerName = a.process?.dealer?.firmName ?? a.process?.dealer?.dealerName
  return {
    key: `a:${a.assignmentId}`,
    title: a.process?.vehicle?.registrationNumber ?? 'Vehicle process',
    subline: [dealerName, a.service?.serviceName ?? a.service?.shortName].filter(Boolean).join(' · '),
    haystack: [a.process?.vehicle?.registrationNumber, dealerName],
    status: null,
    linkTo: `/agent/assignments/${a.assignmentId}`,
    state: { dealerName },
  }
}

/** An agent's own (placeholder-dealer) process → one search result. */
function ownProcessToResult(p) {
  const dealerName = p.dealer?.firmName
  return {
    key: `p:${p.processId}`,
    title: p.vehicle?.registrationNumber ?? 'Vehicle process',
    subline: dealerName ?? '',
    haystack: [p.vehicle?.registrationNumber, dealerName],
    status: null,
    linkTo: p.dealer?.dealerId ? `/agent/dealers/${p.dealer.dealerId}/vehicles/${p.processId}` : null,
    state: { dealerName },
  }
}

// "GJ 05 AB-1234" and "gj05ab1234" should find each other.
const squash = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

function matchesTerm(result, term) {
  const plain = term.toLowerCase()
  const tight = squash(term)
  return result.haystack.some((field) => {
    const text = String(field ?? '').toLowerCase()
    return text.includes(plain) || (tight.length > 0 && squash(text).includes(tight))
  })
}

/**
 * Vehicle-process search: type → matching processes in a dropdown → pick one to open it. Suggestions
 * appear only after you type. Shown large on the dealer dashboard and compact in the header.
 *
 * @param {object} props
 * @param {'dealer'|'agent'} [props.source='dealer'] - `dealer`: server-side search of the dealer's
 *   processes (vehicle number or person name). `agent`: there is no agent-wide search endpoint, so
 *   it filters the agent's own work — assignments plus their own processes — by vehicle number or
 *   dealer name (those lists carry no other vehicle details).
 * @param {boolean} [props.compact=false] - Header size instead of the large dashboard size.
 * @param {boolean} [props.autoFocus=true] - Focus the box when it mounts.
 * @param {() => void} [props.onPicked] - Called after a result was opened.
 */
export function VehicleSearchBox({ source = 'dealer', compact = false, autoFocus = true, onPicked }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const term = q.trim()
  const debounced = useDebounce(term, 300)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const isAgent = source === 'agent'
  const searching = debounced.length > 0

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const dealerQuery = useQuery({
    queryKey: ['vehicle-processes', 'dashboard-search', debounced],
    queryFn: () => vehicleProcessService.getAll({ search: debounced, limit: MAX_RESULTS }),
    enabled: !isAgent && searching,
  })

  // Same keys as the agent Task Board, so the two share one cached copy. `staleTime: 0` re-reads
  // the lists each time a search starts — a "no match" answered from a minutes-old copy would be
  // wrong for a job that was just assigned. Cached matches still show at once meanwhile.
  const assignmentsQuery = useQuery({
    queryKey: ['agent-assignments'],
    queryFn: () => processAssignmentService.listForAgent(),
    enabled: isAgent && searching,
    staleTime: 0,
  })
  const ownProcessesQuery = useQuery({
    queryKey: ['agent-board-processes'],
    queryFn: () => vehicleProcessService.listForAgentBoard(),
    enabled: isAgent && searching,
    staleTime: 0,
  })

  const results = useMemo(() => {
    if (!searching) return []
    if (!isAgent) return (dealerQuery.data?.processes ?? []).map(dealerProcessToResult)
    return [
      ...(assignmentsQuery.data ?? []).map(assignmentToResult),
      ...(ownProcessesQuery.data ?? []).map(ownProcessToResult),
    ]
      .filter((result) => result.linkTo && matchesTerm(result, debounced))
      .slice(0, MAX_RESULTS)
  }, [searching, isAgent, debounced, dealerQuery.data, assignmentsQuery.data, ownProcessesQuery.data])

  const isFetching = isAgent
    ? assignmentsQuery.isFetching || ownProcessesQuery.isFetching
    : dealerQuery.isFetching
  const pending = isFetching || term !== debounced

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const go = (result) => {
    if (!result.linkTo) return
    // The header box outlives the navigation, so reset it instead of leaving the old query behind.
    setQ('')
    setOpen(false)
    navigate(result.linkTo, result.state ? { state: result.state } : undefined)
    onPicked?.()
  }

  const showPanel = open && term.length > 0
  const placeholder = isAgent
    ? 'Search by vehicle number or dealer…'
    : compact
      ? 'Search vehicle processes…'
      : 'Search a vehicle process by number or person name…'

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
            compact ? 'left-3 h-4 w-4' : 'left-4 h-5 w-5',
          )}
        />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={placeholder}
          aria-label="Search vehicle processes"
          className={cn(
            compact ? 'border-0 bg-muted/50 pl-9 pr-9' : 'h-14 rounded-xl pl-12 pr-12 text-base shadow-sm',
          )}
        />
        {pending && term && (
          <Loader2
            className={cn(
              'absolute top-1/2 -translate-y-1/2 animate-spin text-muted-foreground',
              compact ? 'right-3 h-4 w-4' : 'right-4 h-5 w-5',
            )}
          />
        )}
      </div>

      {showPanel && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {pending && results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No vehicle processes match “{term}”.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {results.map((result) => (
                <li key={result.key}>
                  <button
                    type="button"
                    onClick={() => go(result)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{result.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{result.subline || '—'}</p>
                    </div>
                    {result.status && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: result.status.colour }} />
                        {result.status.label}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
