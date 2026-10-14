import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { Car, CircleDashed, IndianRupee, CheckCircle2, Recycle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { VehicleSearchBox } from '@/components/dashboard/VehicleSearchBox'
import { VehicleAvatar } from '@/components/vehicle-process/VehicleAvatar'
import { DateRangePicker } from '@/components/common/DateRangePicker'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { PROCESS_STATUS_LABEL, PROCESS_STATUS_COLOUR } from '@/lib/processStatus'
import { formatDate, formatManufacture } from '@/lib/utils'

const OPEN_COLOUR = '#94a3b8'
const AXIS = '#64748b'
const GRID = '#e2e8f0'
const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
}

/**
 * Buckets processes into a trend series. No range → last 6 months (by month). A range ≤ 62 days →
 * one bar per day; longer → by month. Counts come from the (range-filtered, page-capped) list, so the
 * trend is illustrative while the KPI tiles carry the accurate totals.
 */
function buildTrend(processes, range) {
  const now = new Date()
  let start
  let end
  let granularity
  if (!range) {
    start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    end = now
    granularity = 'month'
  } else {
    start = range.from
    end = range.to
    granularity = (end.getTime() - start.getTime()) / 86400000 <= 62 ? 'day' : 'month'
  }

  const buckets = []
  if (granularity === 'day') {
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    while (cur <= last) {
      buckets.push({
        key: `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`,
        label: cur.toLocaleString('en-IN', { day: '2-digit', month: 'short' }),
        value: 0,
      })
      cur.setDate(cur.getDate() + 1)
    }
  } else {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cur <= last) {
      buckets.push({
        key: `${cur.getFullYear()}-${cur.getMonth()}`,
        label: cur.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        value: 0,
      })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  processes.forEach((p) => {
    if (!p.processDate) return
    const d = new Date(p.processDate)
    const k =
      granularity === 'day'
        ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        : `${d.getFullYear()}-${d.getMonth()}`
    if (idx.has(k)) buckets[idx.get(k)].value += 1
  })
  return buckets
}

/** A colored KPI tile: icon chip + count + label. */
function KpiTile({ icon: Icon, label, value, colour, loading, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
    >
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${colour}1a`, color: colour }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-2xl font-bold leading-tight">{value}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function DealerDashboard() {
  const navigate = useNavigate()

  // Analytics date-range filter (null = All time). Sent as ISO instants to the API.
  const [range, setRange] = useState(null)
  const dateFrom = range ? range.from.toISOString() : undefined
  const dateTo = range ? range.to.toISOString() : undefined
  const rangeKey = range ? `${dateFrom}_${dateTo}` : 'all'

  // A wide page for the recent list + the trend; `total` is the accurate grand total for the range.
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['vehicle-processes', 'dashboard', rangeKey],
    queryFn: () => vehicleProcessService.getAll({ page: 1, limit: 100, dateFrom, dateTo }),
  })
  const processes = useMemo(() => listData?.processes ?? [], [listData])
  const total = listData?.total ?? 0

  // Accurate per-status counts within the range (each query returns just the total for that status).
  const countQueries = useQueries({
    queries: ['OPEN', 'SOLD', 'COMPLETE', 'SCRAP'].map((s) => ({
      queryKey: ['vehicle-processes', 'count', s, rangeKey],
      queryFn: () => vehicleProcessService.getAll({ status: s, limit: 1, dateFrom, dateTo }),
      select: (d) => d.total ?? 0,
    })),
  })
  const [openC, soldC, completeC, scrapC] = countQueries.map((q) => q.data ?? 0)
  const countsLoading = countQueries.some((q) => q.isLoading)

  const kpis = [
    { label: 'Total Processes', value: total, icon: Car, colour: '#2563eb', loading: listLoading },
    { label: 'Open', value: openC, icon: CircleDashed, colour: OPEN_COLOUR, loading: countsLoading },
    { label: 'Sold', value: soldC, icon: IndianRupee, colour: PROCESS_STATUS_COLOUR.SOLD, loading: countsLoading },
    { label: 'Complete', value: completeC, icon: CheckCircle2, colour: PROCESS_STATUS_COLOUR.COMPLETE, loading: countsLoading },
    { label: 'Scrap', value: scrapC, icon: Recycle, colour: PROCESS_STATUS_COLOUR.SCRAP, loading: countsLoading },
  ]

  const statusData = [
    { name: 'Open', value: openC, colour: OPEN_COLOUR },
    { name: PROCESS_STATUS_LABEL.SOLD, value: soldC, colour: PROCESS_STATUS_COLOUR.SOLD },
    { name: PROCESS_STATUS_LABEL.COMPLETE, value: completeC, colour: PROCESS_STATUS_COLOUR.COMPLETE },
    { name: PROCESS_STATUS_LABEL.SCRAP, value: scrapC, colour: PROCESS_STATUS_COLOUR.SCRAP },
  ]

  const monthData = useMemo(() => buildTrend(processes, range), [processes, range])
  // The trend is bucketed from the (page-capped) list; flag it as sampled when the range actually has
  // more than the fetched page so it never silently undercounts. The KPI tiles stay accurate.
  const trendSampled = total > processes.length
  const trendTitle =
    (range ? `New processes (${range.label})` : 'New processes (last 6 months)') +
    (trendSampled ? ' · sampled (100 most recent)' : '')

  const recent = processes.slice(0, 6)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your vehicle processes</p>
        </div>
        <Button onClick={() => navigate('/dealer/processes/new')}>
          <Plus className="mr-2 h-4 w-4" /> New Process
        </Button>
      </motion.div>

      {/* Hero search */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <VehicleSearchBox />
      </motion.div>

      {/* Analytics date-range filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">{range ? range.label : 'all time'}</span>
          {range && (
            <span> · {formatDate(range.from)} – {formatDate(range.to)}</span>
          )}
        </p>
        <DateRangePicker onChange={setRange} />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k, i) => (
          <KpiTile key={k.label} index={i} {...k} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Processes by status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Processes']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {statusData.map((d) => (
                      <Cell key={d.name} fill={d.colour} />
                    ))}
                    <LabelList dataKey="value" position="right" fontSize={12} fill={AXIS} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{trendTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" minTickGap={16} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Processes']} />
                  <Bar dataKey="value" name="Processes" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent processes */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent Processes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dealer/processes')}>
            View all
          </Button>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              title="No processes yet"
              description="Create your first process to start tracking a vehicle."
            />
          ) : (
            <div className="divide-y divide-border">
              {recent.map((proc) => {
                const id = getProcessId(proc)
                const reg = proc?.vehicle?.registrationNumber ?? proc?.registrationNumber ?? 'Vehicle process'
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => id && navigate(`/dealer/processes/${id}`)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <VehicleAvatar photoUrl={proc.starredPhotoUrl} className="h-10 w-10" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{reg}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[
                            proc.vehicle?.model,
                            formatManufacture(proc.vehicle?.manufactureMonth, proc.vehicle?.manufactureYear),
                            proc.processDate ? formatDate(proc.processDate) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {proc.status ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROCESS_STATUS_COLOUR[proc.status] }} />
                          {PROCESS_STATUS_LABEL[proc.status]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Open</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
