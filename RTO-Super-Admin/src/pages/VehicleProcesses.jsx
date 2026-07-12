import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Eye, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/tables/DataTable'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { dealerStatusService } from '@/services/dealerStatusService'
import { PAGE_SIZE } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

const PROCESS_PAGE_SIZE = PAGE_SIZE.crud
const ALL_STATUSES = '__all__'

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
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['vehicle-processes', page, PROCESS_PAGE_SIZE],
    queryFn: () => vehicleProcessService.getAll({ page, limit: PROCESS_PAGE_SIZE }),
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ['dealer-statuses'],
    queryFn: () => dealerStatusService.getAll(),
  })

  const processes = useMemo(() => data?.processes ?? [], [data])
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  // Client-side filter of the current page (the API has no status query param).
  const visible = useMemo(() => {
    if (statusFilter === ALL_STATUSES) return processes
    return processes.filter((p) => (p.status ?? '').toLowerCase() === statusFilter.toLowerCase())
  }, [processes, statusFilter])

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
        render: (row) => <Badge variant="secondary">{row.status ?? 'Pending'}</Badge>,
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.statusId} value={s.statusName}>{s.statusName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate('/dealer/board')}>
            <LayoutGrid className="mr-2 h-4 w-4" /> Board
          </Button>
          <Button onClick={() => navigate('/dealer/processes/new')}>
            <Plus className="mr-2 h-4 w-4" /> New Process
          </Button>
        </div>
      </motion.div>

      <DataTable
        mode="server"
        columns={columns}
        data={visible}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PROCESS_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="processes"
        emptyTitle={statusFilter === ALL_STATUSES ? 'No vehicle processes yet' : 'No processes with this status on this page'}
        emptyDescription={statusFilter === ALL_STATUSES ? 'Create your first process to start tracking a vehicle.' : 'Try another status or clear the filter.'}
        showExport={false}
        selectable={false}
        onRowClick={openDetail}
        getRowId={getProcessId}
      />
    </div>
  )
}
