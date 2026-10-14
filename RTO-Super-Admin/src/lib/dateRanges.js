// Preset date-range helpers for the dashboard analytics filter. Ranges are inclusive [from, to] Date
// instants in the viewer's LOCAL time; the caller sends `.toISOString()` to the API. `null` = All time.

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}
export function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
/** Monday of the week containing `d` (ISO week start). */
function startOfWeek(d) {
  const offset = (d.getDay() + 6) % 7 // days since Monday (getDay: 0=Sun..6=Sat)
  return startOfDay(addDays(d, -offset))
}

export const DATE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
]

/**
 * Compute a `{ from, to }` (Date) range for a preset key, relative to `now`. Returns `null` for
 * 'all' and 'custom' (custom is driven by the user's two date inputs).
 */
export function computePreset(key, now = new Date()) {
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const y = addDays(now, -1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case 'tomorrow': {
      const t = addDays(now, 1)
      return { from: startOfDay(t), to: endOfDay(t) }
    }
    case 'thisWeek': {
      const s = startOfWeek(now)
      return { from: s, to: endOfDay(addDays(s, 6)) }
    }
    case 'lastWeek': {
      const s = addDays(startOfWeek(now), -7)
      return { from: startOfDay(s), to: endOfDay(addDays(s, 6)) }
    }
    case 'thisMonth': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: startOfDay(s), to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { from: startOfDay(s), to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)) }
    }
    default:
      return null // 'all' / 'custom'
  }
}

/** Parse a native date-input value ('YYYY-MM-DD') as a LOCAL Date at midnight, or null. */
export function parseLocalDate(value) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
