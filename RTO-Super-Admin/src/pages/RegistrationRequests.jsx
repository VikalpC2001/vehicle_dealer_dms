import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/tables/DataTable'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { RejectRegistrationDialog } from '@/components/registrations/RejectRegistrationDialog'
import { registrationService } from '@/services/registrationService'
import { getErrorMessage } from '@/lib/authErrors'
import { PAGE_SIZE } from '@/lib/pagination'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const REQ_PAGE_SIZE = PAGE_SIZE.crud
const STATUS_VARIANT = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive' }
const STATUS_FILTERS = [
  { label: 'Open', value: undefined }, // PENDING + REJECTED (backend default)
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
]

/** Stable row id for the merged dealer/agent list. */
function rowId(r) {
  return `${r.kind}:${r.id}`
}

/**
 * Super-admin registration queue: self-registered dealers/agents awaiting approval. Approve unlocks
 * access (a dealer is also subscribed); reject blocks it with a reason.
 */
export default function RegistrationRequests() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(undefined)
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['registrations', page, REQ_PAGE_SIZE, statusFilter],
    queryFn: () => registrationService.getAll({ page, limit: REQ_PAGE_SIZE, status: statusFilter }),
  })

  const rows = data?.registrations ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['registrations'] })

  const approveMutation = useMutation({
    mutationFn: ({ kind, id }) => registrationService.approve(kind, id),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Registration approved', description: 'The applicant can now access their panel.', variant: 'success' })
      setApproveTarget(null)
    },
    onError: (err) => toast({ title: 'Could not approve', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ kind, id, reason }) => registrationService.reject(kind, id, reason),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Registration rejected', variant: 'success' })
      setRejectTarget(null)
    },
    onError: (err) => toast({ title: 'Could not reject', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const columns = useMemo(
    () => [
      { key: 'firmName', label: 'Firm', render: (r) => <span className="font-semibold">{r.firmName}</span> },
      { key: 'applicantName', label: 'Applicant' },
      { key: 'kind', label: 'Type', render: (r) => <Badge variant="outline">{r.kind === 'agent' ? 'Agent' : 'Dealer'}</Badge> },
      {
        key: 'emailId',
        label: 'Contact',
        render: (r) => (
          <div className="text-sm">
            <div>{r.emailId}</div>
            <div className="text-muted-foreground">{r.mobileNo}</div>
          </div>
        ),
      },
      { key: 'approvalStatus', label: 'Status', render: (r) => <Badge variant={STATUS_VARIANT[r.approvalStatus] ?? 'secondary'}>{r.approvalStatus}</Badge> },
      { key: 'createdAt', label: 'Requested', render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—') },
      {
        label: 'Actions',
        render: (r) => (
          <div className="flex items-center gap-1">
            {r.approvalStatus !== 'APPROVED' && (
              <Button variant="ghost" size="icon" onClick={() => setApproveTarget(r)} aria-label="Approve" title="Approve">
                <Check className="h-4 w-4 text-success" />
              </Button>
            )}
            {r.approvalStatus === 'PENDING' && (
              <Button variant="ghost" size="icon" onClick={() => setRejectTarget(r)} aria-label="Reject" title="Reject">
                <X className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Registration Requests</h1>
        <p className="mt-1 text-muted-foreground">Review self-registered dealers &amp; agents and grant access</p>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={statusFilter === f.value ? 'default' : 'outline'}
            size="sm"
            className={cn(statusFilter === f.value && 'gradient-bg text-white')}
            onClick={() => {
              setStatusFilter(f.value)
              setPage(1)
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <DataTable
        mode="server"
        columns={columns}
        data={rows}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={REQ_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="requests"
        emptyTitle="No registration requests"
        emptyDescription="Self-registrations from the public Register page appear here."
        showExport={false}
        selectable={false}
        getRowId={rowId}
      />

      <ConfirmModal
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
        title="Approve registration"
        description={`Grant ${approveTarget?.firmName ?? 'this applicant'} access to their ${approveTarget?.kind === 'agent' ? 'agent' : 'dealer'} panel? They'll be emailed and can sign in immediately.`}
        confirmLabel="Approve"
        onConfirm={() => approveTarget && approveMutation.mutate({ kind: approveTarget.kind, id: approveTarget.id })}
        loading={approveMutation.isPending}
      />

      <RejectRegistrationDialog
        key={rejectTarget ? rowId(rejectTarget) : 'reject'}
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        request={rejectTarget}
        onConfirm={(reason) => rejectTarget && rejectMutation.mutate({ kind: rejectTarget.kind, id: rejectTarget.id, reason })}
        loading={rejectMutation.isPending}
      />
    </div>
  )
}
