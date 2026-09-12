import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/tables/DataTable'
import { SearchInput } from '@/components/common/SearchInput'
import { NewTaskButton } from '@/components/vehicle-process/NewTaskButton'
import { TagChip } from '@/components/vehicle-process/TagChip'
import { useDebounce } from '@/hooks/useDebounce'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { dealerTagService } from '@/services/dealerTagService'
import { PROCESS_STATUSES, PROCESS_STATUS_LABEL, PROCESS_STATUS_COLOUR } from '@/lib/processStatus'
import { PAGE_SIZE } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

const PROCESS_PAGE_SIZE = PAGE_SIZE.crud
const ALL_TAGS = '__all__'
const STATUS_ALL = 'ALL'
// Vehicle-list status tabs: All · Open (no status) · Sold · Complete · Scrap.
const STATUS_TABS = [
  { value: STATUS_ALL, label: 'All' },
  { value: 'OPEN', label: 'Open' },
  ...PROCESS_STATUSES.map((s) => ({ value: s.value, label: s.label })),
]

function tagIdOf(t) {
  return t?.tagId ?? t?.id
}

function registrationOf(row) {
  return row?.vehicle?.registrationNumber ?? row?.registrationNumber ?? '—'
}

function sellerOf(row) {
  const seller = (row?.persons ?? []).find((p) => p.personType === 'SELLER')
  return seller?.personName ?? '—'
}

export default function VehicleProcesses() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [tagFilter, setTagFilter] = useState(ALL_TAGS)
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput.trim(), 300)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['vehicle-processes', page, PROCESS_PAGE_SIZE, search, tagFilter, statusFilter],
    queryFn: () =>
      vehicleProcessService.getAll({
        page,
        limit: PROCESS_PAGE_SIZE,
        search,
        tagId: tagFilter === ALL_TAGS ? undefined : tagFilter,
        status: statusFilter === STATUS_ALL ? undefined : statusFilter,
      }),
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['dealer-tags'],
    queryFn: () => dealerTagService.getAll(),
  })

  const processes = useMemo(() => data?.processes ?? [], [data])
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const openDetail = (row) => {
    const id = getProcessId(row)
    if (id) navigate(`/dealer/processes/${id}`)
  }

  const columns = useMemo(
    () => [
      {
        key: 'registrationNumber',
        label: 'Vehicle Number',
        render: (row) => <span className="font-semibold">{registrationOf(row)}</span>,
      },
      { label: 'Seller', render: (row) => sellerOf(row) },
      {
        key: 'status',
        label: 'Status',
        render: (row) =>
          row.status ? (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PROCESS_STATUS_COLOUR[row.status] }}
              />
              {PROCESS_STATUS_LABEL[row.status] ?? row.status}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Open</span>
          ),
      },
      {
        key: 'tags',
        label: 'Tags',
        render: (row) => {
          const rowTags = row.tags ?? []
          if (rowTags.length === 0) return <span className="text-muted-foreground">—</span>
          return (
            <div className="flex flex-wrap gap-1">
              {rowTags.map((t) => (
                <TagChip key={tagIdOf(t)} name={t.tagName} colour={t.colour} />
              ))}
            </div>
          )
        },
      },
      {
        key: 'processDate',
        label: 'Process Date',
        render: (row) => (row.processDate ? formatDate(row.processDate) : '—'),
      },
      {
        label: 'Actions',
        render: (row) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              openDetail(row)
            }}
            aria-label="View process"
          >
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Vehicle Processes</h1>
          <p className="text-muted-foreground mt-1">Manage your vehicle buy/sell records and RTO processes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={searchInput}
            onChange={(v) => {
              setSearchInput(v)
              setPage(1)
            }}
            placeholder="Search vehicle no. or name"
            className="w-full sm:w-64"
          />
          <Select
            value={tagFilter}
            onValueChange={(v) => {
              setTagFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS}>All tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={tagIdOf(t)} value={tagIdOf(t)}>{t.tagName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NewTaskButton />
          <Button onClick={() => navigate('/dealer/processes/new')}>
            <Plus className="mr-2 h-4 w-4" /> New Process
          </Button>
        </div>
      </motion.div>

      <Tabs
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        mode="server"
        columns={columns}
        data={processes}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PROCESS_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="processes"
        emptyTitle={
          search
            ? 'No matching processes'
            : statusFilter !== STATUS_ALL
              ? 'No processes with this status'
              : tagFilter !== ALL_TAGS
                ? 'No processes with this tag'
                : 'No vehicle processes yet'
        }
        emptyDescription={
          search
            ? 'No processes match your search. Try a different vehicle number or name.'
            : statusFilter !== STATUS_ALL
              ? 'No processes in this status. Try another tab.'
              : tagFilter !== ALL_TAGS
                ? 'No processes carry this tag yet. Try another tag or clear the filter.'
                : 'Create your first process to start tracking a vehicle.'
        }
        showExport={false}
        selectable={false}
        onRowClick={openDetail}
        getRowId={getProcessId}
      />
    </div>
  )
}
