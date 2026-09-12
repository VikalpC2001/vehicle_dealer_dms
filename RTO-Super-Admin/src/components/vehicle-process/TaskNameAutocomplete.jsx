import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * A free-text input with a suggestion dropdown (autocomplete). Type a task name and matching
 * `suggestions` (the dealer's job templates) appear below; click or arrow+Enter to pick one, or just
 * type your own custom value. Controlled: the caller owns `value` and gets updates via `onChange`.
 *
 * @param {object} props
 * @param {string} props.value - Current text value.
 * @param {(value: string) => void} props.onChange - Called on every keystroke and on selection.
 * @param {string[]} [props.suggestions] - Candidate strings to suggest (e.g. job-template names).
 * @param {string} [props.id]
 * @param {string} [props.placeholder]
 */
export function TaskNameAutocomplete({ value = '', onChange, suggestions = [], id, placeholder }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const wrapRef = useRef(null)
  const itemRefs = useRef([])

  const q = (value ?? '').trim().toLowerCase()
  const filtered = suggestions.filter((s) => s && (!q || s.toLowerCase().includes(q)))
  // Nothing useful to show if the only match is exactly what's already typed.
  const showList = open && filtered.length > 0 && !(filtered.length === 1 && filtered[0].toLowerCase() === q)

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return undefined
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  // Keep the arrow-highlighted item scrolled into view within the dropdown.
  useEffect(() => {
    if (highlight >= 0) itemRefs.current[highlight]?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const select = (s) => {
    onChange?.(s)
    setOpen(false)
    setHighlight(-1)
  }

  const onKeyDown = (e) => {
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      select(filtered[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange?.(e.target.value)
          setOpen(true)
          setHighlight(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card p-1 text-foreground shadow-md">
          {filtered.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                // mouseDown (not click) so selection fires before the input blurs / outside-close runs.
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(s)
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'w-full rounded px-2 py-1.5 text-left text-sm',
                  i === highlight ? 'bg-muted' : 'hover:bg-muted'
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
