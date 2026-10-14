import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { vehicleHistoryService } from '@/services/vehicleHistoryService'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDate } from '@/lib/utils'

/** 2-decimal INR formatter (the shared `formatCurrency` is whole-rupee). */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const formatMoney = (n) => inr.format(Number(n ?? 0))

/** A 404 (code 4047) means the dealer has no recorded history for this vehicle. */
const isNotFound = (error) => error?.response?.status === 404 || error?.response?.data?.code === 4047

const signedClass = (value) =>
  value == null
    ? 'text-sm font-semibold text-muted-foreground'
    : value >= 0
      ? 'text-sm font-semibold text-success'
      : 'text-sm font-semibold text-destructive'

/**
 * Vehicle history for one registration number — the dealer's buy/sell timeline across ALL their
 * processes for the vehicle, plus a profit summary and cross-dealer "changed hands" info. Reuses the
 * shipped `GET /vehicles/history` feature; rendered inside the History tab of the process detail page.
 *
 * @param {object} props
 * @param {string} props.registrationNumber
 * @param {string} [props.currentProcessId] Highlighted in the timeline as "This process".
 */
export function VehicleHistoryPanel({ registrationNumber, currentProcessId }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['vehicle-history', registrationNumber],
    queryFn: () => vehicleHistoryService.getHistory(registrationNumber),
    enabled: Boolean(registrationNumber),
    retry: false,
  })

  const summary = data?.summary ?? null
  const market = data?.market ?? null
  const events = data?.events ?? []

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (row) => <span className="whitespace-nowrap">{row.date ? formatDate(row.date) : '—'}</span>,
    },
    {
      key: 'kind',
      label: 'Type',
      render: (row) => <Badge variant={row.kind === 'SELL' ? 'success' : 'secondary'}>{row.kind}</Badge>,
    },
    {
      key: 'counterpartyName',
      label: 'Counterparty',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.counterpartyName || '—'}</span>
          {row.counterpartyMobile && <span className="text-xs text-muted-foreground">{row.counterpartyMobile}</span>}
        </div>
      ),
    },
    {
      key: 'referenceName',
      label: 'Reference',
      render: (row) =>
        row.referenceName ? (
          <span className="font-medium">{row.referenceName}</span>
        ) : (
          <Badge variant="secondary">Self</Badge>
        ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row) =>
        row.amount != null ? (
          <span className="whitespace-nowrap font-medium">{formatMoney(row.amount)}</span>
        ) : (
          <span className="text-muted-foreground">Not recorded</span>
        ),
    },
    {
      label: 'Process',
      render: (row) =>
        row.processId === currentProcessId ? (
          <Badge variant="outline">This process</Badge>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/dealer/processes/${row.processId}`}>View</Link>
          </Button>
        ),
    },
  ]

  if (!registrationNumber) {
    return <EmptyState title="No history" description="This vehicle has no registration number to look up history." />
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return isNotFound(error) ? (
      <EmptyState title="No history yet" description="No buy/sell history has been recorded for this vehicle." />
    ) : (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {market && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <History className="h-4 w-4" />
          <span>
            Changed hands {market.changedHands} time{market.changedHands === 1 ? '' : 's'} across{' '}
            {market.dealersInvolved} dealership{market.dealersInvolved === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {summary && (
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="text-base">Your dealership</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Gross margin (total)</dt>
                <dd className={signedClass(summary.grossMarginTotal)}>
                  {summary.grossMarginTotal == null ? 'Not recorded' : formatMoney(summary.grossMarginTotal)}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Expenses (total)</dt>
                <dd className="text-sm font-medium">{formatMoney(summary.expenseTotal)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Net profit (total)</dt>
                <dd className={signedClass(summary.netProfitTotal)}>
                  {summary.netProfitTotal == null ? 'Not recorded' : formatMoney(summary.netProfitTotal)}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Processes</dt>
                <dd className="text-sm font-medium">
                  {summary.processCount} process{summary.processCount === 1 ? '' : 'es'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            mode="client"
            columns={columns}
            data={events}
            itemLabel="events"
            emptyTitle="No events"
            emptyDescription="No buy/sell events recorded for this vehicle."
            showExport={false}
            selectable={false}
            getRowId={(row) => `${row.processId}-${row.kind}`}
          />
        </CardContent>
      </Card>
    </div>
  )
}
