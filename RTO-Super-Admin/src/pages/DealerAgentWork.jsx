import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Car, ClipboardList, Eye, FileCheck2, Mail, Phone, RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchInput } from '@/components/common/SearchInput'
import { EmptyState } from '@/components/common/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { TagChip } from '@/components/vehicle-process/TagChip'
import { AgentStatusPill } from '@/components/vehicle-process/AgentStatusPill'
import { processAssignmentService } from '@/services/processAssignmentService'
import { useDebounce } from '@/hooks/useDebounce'
import { getErrorCode, getErrorMessage } from '@/lib/authErrors'
import { PROCESS_STATUS_COLOUR, PROCESS_STATUS_LABEL } from '@/lib/processStatus'
import { cn, formatDate } from '@/lib/utils'

const PAGE_SIZE = 10
/** The backend accepts at most this many characters of search text. */
const SEARCH_MAX = 100
/** Status filter values that are not an agent status id. */
const ALL_STATUSES = 'all'
const NO_STATUS = 'none'
/** Backend code for "this dealer has never granted that agent" (also an unknown agent id). */
const AGENT_NOT_FOUND = 4044

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const formatMoney = (n) => inr.format(Number(n ?? 0))

const Dash = () => <span className="text-muted-foreground">—</span>

/** A link that cannot work: an agent this dealer never granted, or an id that is not an id at all. */
const isAgentNotFound = (err) =>
  getErrorCode(err) === AGENT_NOT_FOUND ||
  (getErrorCode(err) === 4220 && Boolean(err?.response?.data?.errors?.['params.agentId']))

/** Retry once, but never a request the server refused (4xx): asking again gives the same answer. */
const retryUnlessRefused = (count, err) => {
  const status = err?.response?.status
  return !(status >= 400 && status < 500) && count < 1
}

function SummaryTile({ icon: Icon, label, value, loading, index, className }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
    >
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="truncate text-2xl font-bold leading-tight" title={String(value)}>
                {value}
              </p>
            )}
            <p className="truncate text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Dealer view of ONE agent: every vehicle process the dealer has assigned to that agent, with the
 * work (RTO service), its cost, the agent's own status for it and the process details. Opened by
 * clicking an agent on "My Agents". Read-only: jobs are changed from the vehicle process itself.
 */
export default function DealerAgentWork() {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES)
  // Cut to the server's limit; drop half of a character pair (an emoji) left at the cut, which a URL cannot carry.
  const search = useDebounce(searchInput.trim().slice(0, SEARCH_MAX).replace(/[\uD800-\uDBFF]$/, ''), 300)

  // The agent moves these statuses from their own account, so never serve this page from cache.
  const summaryQuery = useQuery({
    queryKey: ['dealer-agent-work', agentId, 'summary'],
    queryFn: () => processAssignmentService.getDealerAgentSummary(agentId),
    enabled: Boolean(agentId),
    staleTime: 0,
    retry: retryUnlessRefused,
  })
  const listQuery = useQuery({
    queryKey: ['dealer-agent-work', agentId, 'list', page, PAGE_SIZE, search, statusFilter],
    queryFn: () =>
      processAssignmentService.listForDealerAgent(agentId, {
        page,
        limit: PAGE_SIZE,
        search,
        agentStatusId: statusFilter === ALL_STATUSES ? undefined : statusFilter,
      }),
    enabled: Boolean(agentId),
    staleTime: 0,
    retry: retryUnlessRefused,
  })

  const summary = summaryQuery.data
  const agent = summary?.agent
  const totals = summary?.totals
  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data])
  // Jobs can leave the list while this page is open (the agent moves one out of the filtered status,
  // or one is cancelled elsewhere), so the page being shown may no longer exist: fall back to the last.
  const lastPage = listQuery.data?.totalPages ?? 1
  if (listQuery.data && !listQuery.isFetching && page > lastPage) setPage(lastPage)
  // Statuses that have at least one job, in the agent's own board order ("No status" comes last).
  const statusChips = (summary?.byStatus ?? []).filter((s) => s.count > 0)

  const openProcess = (row) => {
    const processId = row.process?.processId ?? row.processId
    if (!processId) return
    // This list is always fresh, so the process page must not answer from an older cached copy of
    // the same job (the agent may have moved it, or added the receipt, since it was last opened).
    queryClient.invalidateQueries({ queryKey: ['process-assignments', processId] })
    queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId] })
    // Land on the tab that holds this job (agent, cost, receipt, tracking number); "Back" returns here.
    navigate(`/dealer/processes/${processId}`, { state: { tab: 'rto', from: `/dealer/agents/${agentId}` } })
  }
  const changeStatusFilter = (value) => {
    setStatusFilter(value)
    setPage(1)
  }
  const refresh = () => {
    summaryQuery.refetch()
    listQuery.refetch()
  }

  const columns = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (row) => {
        const vehicle = row.process?.vehicle
        const model = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ')
        const tags = row.process?.tags ?? []
        const processStatus = row.process?.status
        return (
          <div className="min-w-[8.5rem]">
            <p className="whitespace-nowrap font-semibold">{vehicle?.registrationNumber || '—'}</p>
            {(model || vehicle?.manufactureYear) && (
              <p className="text-xs text-muted-foreground">
                {[model, vehicle?.manufactureYear].filter(Boolean).join(' · ')}
              </p>
            )}
            {/* The dealer's own process status (not the agent's) and deal number. */}
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {processStatus && (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROCESS_STATUS_COLOUR[processStatus] }} />
                )}
                {processStatus ? (PROCESS_STATUS_LABEL[processStatus] ?? processStatus) : 'Open'}
              </span>
              {row.process?.dealNumber && <span className="whitespace-nowrap">Deal No: {row.process.dealNumber}</span>}
            </p>
            {tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <TagChip key={t.tagId} name={t.tagName} colour={t.colour} />
                ))}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'work',
      label: 'Work',
      render: (row) => (
        <div className="min-w-[9rem] max-w-[15rem]">
          <p className="font-medium">{row.service?.serviceName || row.service?.shortName || '—'}</p>
          {row.note && (
            <p className="line-clamp-2 break-words text-xs text-muted-foreground" title={row.note}>
              {row.note}
            </p>
          )}
          {row.createdAt && (
            <p className="whitespace-nowrap text-xs text-muted-foreground">Assigned {formatDate(row.createdAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'agentStatus',
      label: 'Agent status',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          {row.agentStatus ? (
            <AgentStatusPill status={row.agentStatus} className="whitespace-nowrap" />
          ) : (
            <span className="text-xs text-muted-foreground">Not started</span>
          )}
          {row.status === 'COMPLETED' && <Badge variant="secondary">Closed</Badge>}
        </div>
      ),
    },
    {
      key: 'cost',
      label: 'Cost',
      render: (row) =>
        row.cost ? (
          <div className="whitespace-nowrap">
            <p className="font-medium">{formatMoney(row.cost.amount)}</p>
            {row.cost.entryDate && <p className="text-xs text-muted-foreground">{formatDate(row.cost.entryDate)}</p>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No cost</span>
        ),
    },
    {
      key: 'rcBook',
      label: 'RC book',
      render: (row) => {
        const tracking = row.process?.trackingNumber
        const hasReceipt = row.process?.hasReceipt
        if (!tracking && !hasReceipt) return <Dash />
        return (
          <div className="space-y-1">
            {tracking && (
              <p className="whitespace-nowrap font-mono text-xs" title="RC book tracking number">
                {tracking}
              </p>
            )}
            {hasReceipt && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-success">
                <FileCheck2 className="h-3.5 w-3.5" /> Receipt uploaded
              </span>
            )}
          </div>
        )
      },
    },
    {
      label: 'Action',
      render: (row) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            openProcess(row)
          }}
          aria-label={`Open vehicle process ${row.process?.vehicle?.registrationNumber ?? ''}`.trim()}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const backButton = (
    <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-7 px-2 text-muted-foreground" asChild>
      <Link to="/dealer/agents">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> My Agents
      </Link>
    </Button>
  )

  // An agent this dealer never granted (or a wrong link): nothing else on the page can load.
  if (summaryQuery.isError && isAgentNotFound(summaryQuery.error)) {
    return (
      <div className="space-y-6">
        <div>{backButton}</div>
        <Card>
          <CardContent className="py-4">
            <EmptyState title="Agent not found" description="This agent is not in your agents list." />
          </CardContent>
        </Card>
      </div>
    )
  }

  const filtered = Boolean(search) || statusFilter !== ALL_STATUSES
  const loadFailed = summaryQuery.isError || listQuery.isError
  const agentName = agent?.displayName || agent?.firmName || 'Agent'

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        {backButton}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {summaryQuery.isPending ? (
                <Skeleton className="h-9 w-56" />
              ) : (
                <h1 className="min-w-0 break-words text-3xl font-bold">{agentName}</h1>
              )}
              {summary?.grantStatus === 'ACTIVE' && <Badge variant="success">Active</Badge>}
              {summary?.grantStatus === 'REVOKED' && <Badge variant="secondary">Removed</Badge>}
            </div>
            <p className="mt-1 text-muted-foreground">Vehicle processes you have assigned to this agent, with the work, cost and the agent&apos;s status.</p>
            {agent && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {agent.agentName && <span className="min-w-0 break-words">{agent.agentName}</span>}
                {agent.emailId && (
                  <span className="flex min-w-0 items-center gap-1.5 break-all">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {agent.emailId}
                  </span>
                )}
                {agent.mobileNo && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {agent.mobileNo}
                  </span>
                )}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-start"
            onClick={refresh}
            disabled={summaryQuery.isFetching || listQuery.isFetching}
          >
            <RefreshCw className={cn('mr-1.5 h-4 w-4', (summaryQuery.isFetching || listQuery.isFetching) && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryTile index={0} icon={Car} label="Vehicle processes" value={totals?.processes ?? 0} loading={summaryQuery.isPending} />
        <SummaryTile index={1} icon={ClipboardList} label="Works assigned" value={totals?.assignments ?? 0} loading={summaryQuery.isPending} />
        <SummaryTile
          index={2}
          icon={Wallet}
          label="Total cost"
          value={formatMoney(totals?.totalCost)}
          loading={summaryQuery.isPending}
          className="sm:col-span-2 xl:col-span-1"
        />
      </div>

      {statusChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by agent status">
          <StatusChip active={statusFilter === ALL_STATUSES} onClick={() => changeStatusFilter(ALL_STATUSES)} label="All" count={totals?.assignments ?? 0} />
          {statusChips.map((s) => {
            const value = s.statusId ?? NO_STATUS
            return (
              <StatusChip
                key={value}
                active={statusFilter === value}
                onClick={() => changeStatusFilter(value)}
                label={s.statusId ? s.statusName : 'Not started'}
                count={s.count}
                colour={s.colour}
              />
            )
          })}
        </div>
      )}

      <SearchInput
        value={searchInput}
        onChange={(v) => {
          setSearchInput(v)
          setPage(1)
        }}
        placeholder="Search by vehicle number, model or work"
        className="w-full sm:max-w-md"
      />

      {loadFailed ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="font-bold">Could not load this agent&apos;s work</p>
            <p className="text-sm text-muted-foreground">{getErrorMessage(listQuery.error ?? summaryQuery.error)}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          mode="server"
          columns={columns}
          data={rows}
          page={page}
          totalPages={listQuery.data?.totalPages ?? 1}
          total={listQuery.data?.total ?? 0}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          // Also while re-asking for a page whose cached answer is empty: the rows may be back.
          isLoading={listQuery.isPending || (listQuery.isFetching && rows.length === 0)}
          isFetching={listQuery.isFetching}
          itemLabel="works"
          getRowId={(row) => row.assignmentId}
          onRowClick={openProcess}
          showExport={false}
          emptyTitle={filtered ? 'No matching work' : 'No work assigned yet'}
          emptyDescription={
            filtered
              ? 'Nothing matches this search or status. Try a different one.'
              : 'Assign a vehicle process to this agent from the process page (RTO & Agent tab).'
          }
        />
      )}
    </div>
  )
}

function StatusChip({ active, onClick, label, count, colour }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {colour && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colour }} />}
      {label}
      <span className={cn('rounded-full px-1.5 text-[11px]', active ? 'bg-primary/15' : 'bg-muted')}>{count}</span>
    </button>
  )
}
