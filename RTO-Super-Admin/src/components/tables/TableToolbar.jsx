import { cn } from '@/lib/utils'

/**
 * Responsive toolbar row for list pages (search, filters, actions).
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function TableToolbar({ children, className }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  )
}

/**
 * Primary search area — grows to fill available width on desktop.
 */
export function TableToolbarSearch({ children, className }) {
  return <div className={cn('w-full sm:flex-1 sm:max-w-sm', className)}>{children}</div>
}

/**
 * Filter controls row (selects, tabs triggers, etc.).
 */
export function TableToolbarFilters({ children, className }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3', className)}>
      {children}
    </div>
  )
}

/**
 * Right-aligned actions (Add button, export, etc.).
 */
export function TableToolbarActions({ children, className }) {
  return <div className={cn('flex shrink-0 items-center gap-2', className)}>{children}</div>
}
