import { useState } from 'react'
import { CalendarRange } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DATE_PRESETS, computePreset, startOfDay, endOfDay, parseLocalDate } from '@/lib/dateRanges'

/**
 * Analytics date-range filter with quick presets (Today/Yesterday/Tomorrow, This/Last week,
 * This/Last month) + Custom (two date inputs) + All time (default). Calls `onChange(range)` where
 * `range` is `null` (All time) or `{ from: Date, to: Date, label: string }` (inclusive).
 *
 * @param {object} props
 * @param {(range: {from: Date, to: Date, label: string} | null) => void} props.onChange
 */
export function DateRangePicker({ onChange }) {
  const [preset, setPreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const labelOf = (key) => DATE_PRESETS.find((p) => p.key === key)?.label ?? 'All time'

  const emitCustom = (fromStr, toStr) => {
    let from = parseLocalDate(fromStr)
    let to = parseLocalDate(toStr)
    if (!from || !to) {
      onChange(null) // incomplete custom range → show all until both dates are set
      return
    }
    if (from > to) [from, to] = [to, from] // tolerate reversed inputs
    onChange({ from: startOfDay(from), to: endOfDay(to), label: 'Custom' })
  }

  const handlePreset = (key) => {
    setPreset(key)
    if (key === 'custom') {
      emitCustom(customFrom, customTo)
      return
    }
    const range = computePreset(key)
    onChange(range ? { ...range, label: labelOf(key) } : null)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select value={preset} onValueChange={handlePreset}>
        <SelectTrigger className="w-40" aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map((p) => (
            <SelectItem key={p.key} value={p.key}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => {
              setCustomFrom(e.target.value)
              emitCustom(e.target.value, customTo)
            }}
            className="w-40"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => {
              setCustomTo(e.target.value)
              emitCustom(customFrom, e.target.value)
            }}
            className="w-40"
            aria-label="To date"
          />
        </div>
      )}
    </div>
  )
}
