import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Month number (1-12) → full month name, or '' when out of range/empty. */
export function monthName(month) {
  const n = Number(month)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? MONTH_NAMES[n - 1] : ''
}

/** Human "manufacture" label from a 1-12 month + year, e.g. "June 2019" / "2019" / "June" / ''. */
export function formatManufacture(month, year) {
  return [monthName(month), year || ''].filter(Boolean).join(' ')
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function downloadCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// One entry per strength level: its name, the bar fill and the matching text colour.
const PASSWORD_STRENGTH_LEVELS = [
  { label: 'Weak', color: 'bg-destructive', textColor: 'text-destructive' },
  { label: 'Fair', color: 'bg-warning', textColor: 'text-warning' },
  { label: 'Good', color: 'bg-accent', textColor: 'text-accent' },
  { label: 'Strong', color: 'bg-success', textColor: 'text-success' },
]

export function getPasswordStrength(password) {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  // A typed password is never below the first level, so the bar always shows that level's colour.
  const level = Math.max(1, score)
  return { score, percent: level * 25, ...PASSWORD_STRENGTH_LEVELS[level - 1] }
}
