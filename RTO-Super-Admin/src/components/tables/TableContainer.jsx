import { cn } from '@/lib/utils'

/**
 * Standard bordered wrapper for all data tables.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function TableContainer({ children, className }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {children}
    </div>
  )
}
