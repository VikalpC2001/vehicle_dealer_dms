import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * A single-select dropdown you can type to search — a lightweight combobox over value/label options.
 * Stores `value`; shows the matching option's `label`. Type to filter, click or arrow+Enter to pick;
 * the result is always one of the options.
 *
 * Two modes:
 * - **Local** (default): pass the full `options` list; typing filters it client-side.
 * - **Remote**: also pass `onSearch(query)` — the parent fetches and updates `options` (already
 *   filtered by the server) and may pass `loading`. Client-side filtering is skipped. The last-picked
 *   label is remembered so the closed field still shows the selection even after `options` changes.
 *
 * @param {object} props
 * @param {string} props.value - Selected option value ('' = none).
 * @param {(value: string) => void} props.onChange
 * @param {Array<{value: string, label: string}>} props.options
 * @param {(query: string) => void} [props.onSearch] - Enables remote mode.
 * @param {boolean} [props.loading] - Remote fetch in flight.
 * @param {string} [props.placeholder]
 * @param {string} [props.id]
 * @param {string} [props.emptyText] - Shown when a typed query has no matches. In remote mode the
 *   dropdown stays closed until something is typed (suggestions appear only after you type).
 */
export function SearchableSelect({
  value,
  onChange,
  options = [],
  onSearch,
  loading = false,
  placeholder,
  id,
  emptyText = 'No matches',
}) {
  const remote = typeof onSearch === 'function'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [pickedLabel, setPickedLabel] = useState('')
  const wrapRef = useRef(null)
  const itemRefs = useRef([])

  const selected = options.find((o) => o.value === value) || null
  const q = query.trim().toLowerCase()
  // Remote mode shows suggestions only after something is typed (parent fetches on a non-empty query).
  const awaitingInput = remote && q.length === 0
  // Remote results are already server-filtered; only filter locally in local mode.
  const shown = remote ? options : q ? options.filter((o) => (o.label ?? '').toLowerCase().includes(q)) : options
  // Show the selection when closed — falling back to the remembered label if it's not in `options`.
  const displayLabel = value ? selected?.label ?? pickedLabel : ''

  const close = () => {
    setOpen(false)
    setQuery('')
    setHighlight(-1)
  }
  const openMenu = () => {
    setQuery('')
    setHighlight(-1)
    setOpen(true)
    if (remote) onSearch('')
  }

  // Close on an outside click.
  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Keep the arrow-highlighted item scrolled into view.
  useEffect(() => {
    if (open && highlight >= 0) itemRefs.current[highlight]?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const pick = (opt) => {
    onChange?.(opt.value)
    setPickedLabel(opt.label)
    close()
  }

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlight >= 0 && shown[highlight]) pick(shown[highlight])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={open ? query : displayLabel}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlight(-1)
            if (remote) onSearch(e.target.value)
          }}
          onFocus={openMenu}
          onKeyDown={onKeyDown}
          className="pr-8"
        />
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
      {open && !awaitingInput && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card p-1 text-foreground shadow-md">
          {loading && shown.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</li>
          ) : shown.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">{emptyText}</li>
          ) : (
            shown.map((opt, i) => (
              <li key={opt.value}>
                <button
                  type="button"
                  ref={(el) => {
                    itemRefs.current[i] = el
                  }}
                  // mouseDown so the pick fires before the input blurs / outside-close runs.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(opt)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'w-full rounded px-2 py-1.5 text-left text-sm',
                    opt.value === value && 'font-medium',
                    i === highlight ? 'bg-muted' : 'hover:bg-muted'
                  )}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
