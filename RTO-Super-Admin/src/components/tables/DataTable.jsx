import { useState, useMemo, useReducer } from 'react'
import { ArrowUpDown, Download } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/common/EmptyState'
import { TableContainer } from '@/components/tables/TableContainer'
import { TablePagination } from '@/components/tables/TablePagination'
import { TableLoadingSkeleton } from '@/components/tables/TableLoadingSkeleton'
import { PAGE_SIZE } from '@/lib/pagination'
import { downloadCSV } from '@/lib/utils'

/**
 * Unified data table for client-side and server-side paginated lists.
 *
 * @param {object} props
 * @param {Array} props.columns - Column definitions with key, label, sortable, render(row, index)
 * @param {Array} props.data
 * @param {'client'|'server'} [props.mode='client']
 * @param {number} [props.pageSize]
 * @param {number} [props.page] - Server mode: 1-based current page
 * @param {number} [props.totalPages]
 * @param {number} [props.total]
 * @param {(page: number) => void} [props.onPageChange]
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.isFetching]
 * @param {string} [props.emptyTitle]
 * @param {string} [props.emptyDescription]
 * @param {string} [props.exportFilename]
 * @param {string} [props.itemLabel]
 * @param {boolean} [props.showExport]
 * @param {boolean} [props.selectable]
 * @param {Function} [props.onRowClick]
 * @param {Function} [props.bulkActions]
 * @param {(row: object) => string|number} [props.getRowId]
 */
// One shared empty list: an omitted `data` must keep the same identity on every render.
const NO_ROWS = []

// `clientPage` and `selected` are also reset during render (below), so they use useReducer, not useState:
// useState checks an event's update against the last render even when that render was thrown away
// (a pending transition), which drops or miscomputes the update. useReducer has no such shortcut.
const replaceState = (prev, next) => (typeof next === 'function' ? next(prev) : next)

export function DataTable({
  columns,
  data = NO_ROWS,
  mode = 'client',
  pageSize = PAGE_SIZE.client,
  page: serverPage = 1,
  totalPages: serverTotalPages = 1,
  total: serverTotal = 0,
  onPageChange,
  isLoading = false,
  isFetching = false,
  emptyTitle = 'No data found',
  emptyDescription = 'Try adjusting your search or filters.',
  exportFilename = 'export.csv',
  itemLabel = 'items',
  showExport = true,
  selectable = mode === 'client',
  onRowClick,
  bulkActions,
  getRowId = (row) => row.id,
}) {
  const [clientPage, setClientPage] = useReducer(replaceState, 1)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [selected, setSelected] = useReducer(replaceState, [])

  const isServer = mode === 'server'
  const page = isServer ? serverPage : clientPage
  const total = isServer ? serverTotal : data.length
  const resolvedTotalPages = isServer
    ? serverTotalPages
    : Math.max(1, Math.ceil(data.length / pageSize))

  const sortedData = useMemo(() => {
    if (isServer || !sortKey) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir, isServer])

  const visibleData = isServer
    ? sortedData
    : sortedData.slice((clientPage - 1) * pageSize, clientPage * pageSize)

  // Both resets below compare with the previous render and update during render (not in an effect),
  // so the table never paints a stale page or a stale selection.

  // Client mode goes back to page 1 when the row count or the sort changes.
  const pageResetKey = `${isServer}|${data.length}|${sortKey}|${sortDir}`
  const [prevPageResetKey, setPrevPageResetKey] = useState(pageResetKey)
  if (prevPageResetKey !== pageResetKey) {
    setPrevPageResetKey(pageResetKey)
    if (!isServer) setClientPage(1)
  }

  // The selection belongs to one page of one data set: clear it when either changes.
  const [selectionScope, setSelectionScope] = useState({ page, data })
  if (!Object.is(selectionScope.page, page) || selectionScope.data !== data) {
    setSelectionScope({ page, data })
    if (selected.length) setSelected([])
  }

  const handleSort = (key) => {
    if (isServer || !key) return
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handlePageChange = (nextPage) => {
    if (isServer) onPageChange?.(nextPage)
    else setClientPage(nextPage)
  }

  const toggleAll = () => {
    if (selected.length === visibleData.length) setSelected([])
    else setSelected(visibleData.map((row) => getRowId(row)))
  }

  const toggleRow = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleExport = () => {
    const exportData = data.map((row) => {
      const obj = {}
      columns.forEach((col) => {
        if (col.key) obj[col.label] = row[col.key]
      })
      return obj
    })
    downloadCSV(exportData, exportFilename)
  }

  if (isLoading) {
    return <TableLoadingSkeleton rows={Math.min(pageSize, 5)} />
  }

  if (!data.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-4">
      {(showExport || (bulkActions && selected.length > 0)) && (
        <div className="flex items-center justify-between gap-4">
          {bulkActions && selected.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selected.length} selected</span>
              {bulkActions(selected)}
            </div>
          ) : (
            <div />
          )}
          {showExport && (
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )}
        </div>
      )}

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selected.length === visibleData.length && visibleData.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={col.key || col.label}>
                  {col.sortable && !isServer ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 cursor-pointer"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleData.map((row, index) => {
              const rowId = getRowId(row)
              return (
                <TableRow
                  key={rowId}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(rowId)}
                        onCheckedChange={() => toggleRow(rowId)}
                        aria-label={`Select row ${rowId}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key || col.label}>
                      {col.render ? col.render(row, index) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        page={page}
        totalPages={resolvedTotalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        isFetching={isFetching}
        itemLabel={itemLabel}
      />
    </div>
  )
}
