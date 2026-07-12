import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Standard loading placeholder for table list pages.
 *
 * @param {object} props
 * @param {number} [props.rows=5]
 * @param {string} [props.rowClassName]
 * @param {string} [props.className]
 */
export function TableLoadingSkeleton({ rows = 5, rowClassName = 'h-12', className }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading table data">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={cn('w-full rounded-xl', rowClassName)} />
      ))}
    </div>
  )
}
