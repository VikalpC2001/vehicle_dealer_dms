import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Car, History, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

/** A 404 (or "not found") means the dealer has never handled this vehicle. */
const isNotFound = (error) => error?.response?.status === 404 || error?.response?.data?.code === 4047

export default function VehicleHistory() {
  const [input, setInput] = useState('')
  const [reg, setReg] = useState('')
  // Bumped on every submit so re-searching the SAME reg still refetches — otherwise React bails
  // out of the unchanged setReg, the query key never changes, and the button appears dead.
  const [submitCount, setSubmitCount] = useState(0)

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['vehicle-history', reg, submitCount],
    queryFn: () => vehicleHistoryService.getHistory(reg),
    enabled: !!reg,
    retry: false,
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    setReg(input.trim())
    setSubmitCount((c) => c + 1)
  }

  const vehicle = data?.vehicle ?? {}
  const summary = data?.summary ?? null
  const market = data?.market ?? null
  const events = data?.events ?? []

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (row) => (
        <span className="whitespace-nowrap">{row.date ? formatDate(row.date) : '—'}</span>
      ),
    },
    {
      key: 'kind',
      label: 'Type',
      render: (row) => (
        <Badge variant={row.kind === 'SELL' ? 'success' : 'secondary'}>{row.kind}</Badge>
      ),
    },
    {
      key: 'counterpartyName',
      label: 'Counterparty',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.counterpartyName || '—'}</span>
          {row.counterpartyMobile && (
            <span className="text-xs text-muted-foreground">{row.counterpartyMobile}</span>
          )}
        </div>
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
      render: (row) => (
        <Button asChild variant="ghost" size="sm">
          <Link to={`/dealer/processes/${row.processId}`}>View</Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Vehicle History</h1>
        <p className="mt-1 text-muted-foreground">
          Look up your buy/sell history for a vehicle by its registration number.
        </p>
      </motion.div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="registrationNumber">Registration number</Label>
              <Input
                id="registrationNumber"
                placeholder="MH12AB1234"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={!input.trim()}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {!reg ? null : isLoading || isFetching ? (
        <EmptyState title="Searching…" description="Looking up the vehicle history." />
      ) : isError ? (
        isNotFound(error) ? (
          <EmptyState
            title="No history found"
            description="You haven't handled this vehicle, or the registration number doesn't exist."
          />
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
            </CardContent>
          </Card>
        )
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Car className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Vehicle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-2xl font-bold">{vehicle.registrationNumber}</p>
                <p className="text-muted-foreground">
                  {[vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">Chassis number</dt>
                  <dd className="text-sm font-medium">{vehicle.chassisNumber || '—'}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">Engine number</dt>
                  <dd className="text-sm font-medium">{vehicle.engineNumber || '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

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
                    <dd
                      className={
                        summary.grossMarginTotal == null
                          ? 'text-sm font-semibold text-muted-foreground'
                          : summary.grossMarginTotal >= 0
                            ? 'text-sm font-semibold text-success'
                            : 'text-sm font-semibold text-destructive'
                      }
                    >
                      {summary.grossMarginTotal == null ? 'Not recorded' : formatMoney(summary.grossMarginTotal)}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">Expenses (total)</dt>
                    <dd className="text-sm font-medium">{formatMoney(summary.expenseTotal)}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">Net profit (total)</dt>
                    <dd
                      className={
                        summary.netProfitTotal == null
                          ? 'text-sm font-semibold text-muted-foreground'
                          : summary.netProfitTotal >= 0
                            ? 'text-sm font-semibold text-success'
                            : 'text-sm font-semibold text-destructive'
                      }
                    >
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
            <CardHeader className="space-y-0">
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
        </>
      )}
    </div>
  )
}
