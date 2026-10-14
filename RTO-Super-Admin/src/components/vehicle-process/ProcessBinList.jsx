import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/tables/DataTable'
import { TypeConfirmModal } from '@/components/modals/TypeConfirmModal'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { getErrorMessage } from '@/lib/authErrors'
import { PAGE_SIZE } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

const BIN_PAGE_SIZE = PAGE_SIZE.crud

/** Human "time left" label from `daysLeft` (whole days until purge, clamped at 0 by the backend). */
function timeLeftLabel(daysLeft) {
  if (daysLeft == null) return '—'
  if (daysLeft <= 0) return 'Purges today'
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
}

/**
 * Recycle-bin list for soft-deleted vehicle processes, shared by the dealer and agent Bin pages.
 * Server-paginated (mirrors the Dealers page pattern); rows expose Restore and Delete-forever actions.
 *
 * Restore and permanent-delete both invalidate this page's `binQueryKey` AND the active
 * `['vehicle-processes']` list (a restored process reappears there; a purged one is gone for good).
 *
 * @param {object} props
 * @param {string} props.title - Page heading.
 * @param {string} props.description - Page subheading.
 * @param {(string|number)[]} props.binQueryKey - Base query key for this bin, e.g. ['vehicle-processes','bin'].
 * @param {(args: { page: number, limit: number }) => Promise<object>} props.loadBin - Bin loader
 *   (e.g. `vehicleProcessService.getBin` / `getAgentBin`), returning the normalized list shape.
 */
export function ProcessBinList({ title, description, binQueryKey, loadBin }) {
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleteIds, setBulkDeleteIds] = useState([])
  // Bumped on every successful bulk op to force-remount DataTable (see the bulk mutations below).
  const [tableKey, setTableKey] = useState(0)
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...binQueryKey, page, BIN_PAGE_SIZE],
    queryFn: () => loadBin({ page, limit: BIN_PAGE_SIZE }),
  })

  const items = data?.processes ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const invalidateBin = () => {
    // Refresh the bin itself and the active processes list (restore adds a row there; purge removes it).
    queryClient.invalidateQueries({ queryKey: binQueryKey })
    queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
    // A restored agent-own process must reappear on the agent board (no-op on the dealer bin).
    queryClient.invalidateQueries({ queryKey: ['agent-board-processes'] })
  }

  const goBackIfLastRow = () => {
    if (items.length === 1 && page > 1) setPage((current) => current - 1)
  }

  // Bulk analog: selection is per-page, so clearing every visible row empties the page. Only step
  // back when this is genuinely the LAST page — on a full MIDDLE page, rows shift in from later
  // pages, so staying put is correct. `removedCount` is the ACTUAL number removed by the server.
  const goBackIfPageCleared = (removedCount) => {
    if (page > 1 && page >= totalPages && removedCount >= items.length) {
      setPage((current) => current - 1)
    }
  }

  const restoreMutation = useMutation({
    mutationFn: (id) => vehicleProcessService.restore(id),
    onSuccess: () => {
      invalidateBin()
      toast({ title: 'Process restored', description: 'The process is back in your active list.', variant: 'success' })
      goBackIfLastRow()
    },
    onError: (err) => toast({ title: 'Could not restore', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const permanentMutation = useMutation({
    mutationFn: (id) => vehicleProcessService.permanentDelete(id),
    onSuccess: () => {
      invalidateBin()
      toast({ title: 'Process permanently deleted', variant: 'success' })
      setDeleteTarget(null)
      goBackIfLastRow()
    },
    onError: (err) => toast({ title: 'Could not delete', description: getErrorMessage(err), variant: 'destructive' }),
  })

  // Bulk mutations mirror the single-row ones. DataTable auto-clears its selection only when the
  // `data` reference changes — but invalidateBin() refetches in the BACKGROUND, and react-query keeps
  // the prior `data` object reference during a background refetch, so that reset can't
  // be relied on. We bump `tableKey` to remount DataTable, which deterministically resets its internal
  // `selected` to [] and hides the bulk toolbar immediately — closing the stale-selection / re-submit
  // window without waiting on the refetch. (Server-paginated bin has no client sort state to lose.)
  const bulkRestoreMutation = useMutation({
    mutationFn: (processIds) => vehicleProcessService.bulkRestore(processIds),
    onSuccess: (result, processIds) => {
      invalidateBin()
      setTableKey((k) => k + 1)
      const count = result?.count ?? processIds.length
      toast({
        title: 'Processes restored',
        description: `Restored ${count} ${count === 1 ? 'process' : 'processes'} to your active list.`,
        variant: 'success',
      })
      goBackIfPageCleared(count)
    },
    onError: (err) => toast({ title: 'Could not restore', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const bulkPermanentMutation = useMutation({
    mutationFn: (processIds) => vehicleProcessService.bulkPermanentDelete(processIds),
    onSuccess: (result, processIds) => {
      invalidateBin()
      setTableKey((k) => k + 1)
      const count = result?.count ?? processIds.length
      toast({
        title: 'Processes permanently deleted',
        description: `Permanently deleted ${count} ${count === 1 ? 'process' : 'processes'}.`,
        variant: 'success',
      })
      setBulkDeleteOpen(false)
      setBulkDeleteIds([])
      goBackIfPageCleared(count)
    },
    onError: (err) => toast({ title: 'Could not delete', description: getErrorMessage(err), variant: 'destructive' }),
  })

  // Cross-guard: neither bulk op may fire while the other is in flight on the same selection.
  const bulkBusy = bulkRestoreMutation.isPending || bulkPermanentMutation.isPending

  const columns = useMemo(
    () => [
      {
        key: 'registrationNumber',
        label: 'Vehicle',
        render: (row) => <span className="font-semibold">{row.registrationNumber || '—'}</span>,
      },
      {
        key: 'ownerName',
        label: 'Owner',
        render: (row) => row.ownerName || <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'deletedAt',
        label: 'Deleted',
        render: (row) => (row.deletedAt ? formatDate(row.deletedAt) : '—'),
      },
      {
        key: 'daysLeft',
        label: 'Time left',
        render: (row) => {
          const d = row.daysLeft
          const variant = d == null ? 'secondary' : d <= 0 ? 'destructive' : d <= 2 ? 'warning' : 'secondary'
          return <Badge variant={variant}>{timeLeftLabel(d)}</Badge>
        },
      },
      {
        label: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => restoreMutation.mutate(getProcessId(row))}
              disabled={restoreMutation.isPending}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Restore
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(row)}
              aria-label="Delete forever"
              title="Delete forever"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restoreMutation.isPending]
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </motion.div>

      <DataTable
        key={tableKey}
        mode="server"
        columns={columns}
        data={items}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={BIN_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="processes"
        emptyTitle="Bin is empty"
        emptyDescription="Deleted processes appear here for 7 days."
        showExport={false}
        selectable
        getRowId={getProcessId}
        bulkActions={(selectedIds) => (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => bulkRestoreMutation.mutate(selectedIds)}
              disabled={bulkBusy}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Restore selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setBulkDeleteIds(selectedIds)
                setBulkDeleteOpen(true)
              }}
              disabled={bulkBusy}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete forever
            </Button>
          </>
        )}
      />

      <TypeConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete forever"
        description={`This permanently deletes ${deleteTarget?.registrationNumber || 'this process'} and all its data. This cannot be undone.`}
        confirmWord="DELETE"
        confirmLabel="Delete forever"
        variant="destructive"
        onConfirm={() => permanentMutation.mutate(getProcessId(deleteTarget))}
        loading={permanentMutation.isPending}
      />

      <TypeConfirmModal
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title="Delete forever"
        description={`This permanently deletes ${bulkDeleteIds.length} ${bulkDeleteIds.length === 1 ? 'process' : 'processes'} and all their data. This cannot be undone.`}
        confirmWord="DELETE"
        confirmLabel="Delete forever"
        variant="destructive"
        onConfirm={() => bulkPermanentMutation.mutate(bulkDeleteIds)}
        loading={bulkBusy}
      />
    </div>
  )
}
