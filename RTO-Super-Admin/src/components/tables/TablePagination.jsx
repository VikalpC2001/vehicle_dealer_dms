import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPaginationSummary } from '@/lib/pagination'
import { cn } from '@/lib/utils'

/**
 * Standard pagination footer for all data tables.
 * Uses 1-based page indexing throughout the application.
 *
 * @param {object} props
 * @param {number} props.page - Current page (1-based)
 * @param {number} props.totalPages
 * @param {number} props.total - Total item count
 * @param {number} props.pageSize
 * @param {(page: number) => void} props.onPageChange
 * @param {boolean} [props.isFetching]
 * @param {string} [props.itemLabel]
 * @param {string} [props.className]
 */
export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  isFetching = false,
  itemLabel = 'items',
  className,
}) {
  if (totalPages <= 1) return null

  const summary = getPaginationSummary({ page, pageSize, total, itemLabel, isFetching })

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      aria-label="Table pagination"
    >
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[3.5rem] text-center text-sm font-medium" aria-live="polite">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
