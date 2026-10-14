import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Car, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TypeConfirmModal } from '@/components/modals/TypeConfirmModal'
import { Tabs } from '@/components/ui/tabs'
import { AnimatedTabsList, AnimatedTabPanel } from '@/components/common/AnimatedTabs'
import { DealPricePanel } from '@/components/vehicle-process/DealPricePanel'
import { ExpensesPanel } from '@/components/vehicle-process/ExpensesPanel'
import { PersonsPanel } from '@/components/vehicle-process/PersonsPanel'
import { TasksPanel } from '@/components/vehicle-process/TasksPanel'
import { RtoReceiptPanel } from '@/components/vehicle-process/RtoReceiptPanel'
import { DocumentsPanel } from '@/components/vehicle-process/DocumentsPanel'
import { VehiclePhotosPanel } from '@/components/vehicle-process/VehiclePhotosPanel'
import { CommentsWidget } from '@/components/vehicle-process/CommentsWidget'
import { VehicleEditDialog } from '@/components/vehicle-process/VehicleEditDialog'
import { TagPicker } from '@/components/vehicle-process/TagPicker'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { agentStatusService } from '@/services/agentStatusService'
import { VehicleAvatar } from '@/components/vehicle-process/VehicleAvatar'
import { PhotoGalleryDialog } from '@/components/vehicle-process/PhotoGalleryDialog'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDate, formatManufacture } from '@/lib/utils'
import { exportProcessImagesZip } from '@/lib/zip'
import { toast } from '@/hooks/use-toast'

const TABS = [
  { value: 'overview', label: 'Vehicle & Deal' },
  { value: 'persons', label: 'Seller & Buyer' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'documents', label: 'Documents' },
  { value: 'vehicle-photos', label: 'Vehicle Photos' },
  { value: 'rto', label: 'RTO & RC Book' },
]

/**
 * Agent-side detail for a vehicle process on a dealer the agent manages (a placeholder they own or a
 * granted/connected real dealer). Fully editable — the agent works their own process just like a
 * dealer: edit persons/deal/expenses/tasks (dealer-scoped child calls carry the managed `dealerId`),
 * move it through their own kanban statuses, and delete it. Mirrors the dealer detail UI (animated
 * tabs + gallery + floating comments). The kanban control drives the AGENT status (Task Board column).
 */
export default function AgentVehicleProcessDetail() {
  const { dealerId, id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dealerName = state?.dealerName ?? 'Dealer'
  const [tab, setTab] = useState('overview')
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editVehicle, setEditVehicle] = useState(false)
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)
  const [avatarIndex, setAvatarIndex] = useState(0)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle-process', id, 'details'],
    queryFn: () => vehicleProcessService.getDetails(id),
    enabled: Boolean(id),
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ['agent-statuses'],
    queryFn: () => agentStatusService.getAll(),
  })

  const backTo = `/agent/dealers/${dealerId}/vehicles`

  const statusMutation = useMutation({
    mutationFn: (agentStatusId) => vehicleProcessService.updateAgentStatus(id, agentStatusId),
    // The saved status goes straight into the cache, so the dropdown shows it even if the refetch fails.
    onSuccess: (_data, agentStatusId) => {
      queryClient.setQueryData(['vehicle-process', id, 'details'], (old) => old && { ...old, agentStatusId })
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', id, 'details'] })
      queryClient.invalidateQueries({ queryKey: ['agent-board-processes'] })
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not change status', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => vehicleProcessService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes', 'agent', dealerId] })
      queryClient.invalidateQueries({ queryKey: ['agent-board-processes'] })
      toast({ title: 'Process moved to Bin', variant: 'success' })
      navigate(backTo, { state: { dealerName } })
    },
    onError: (err) =>
      toast({ title: 'Could not delete', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportProcessImagesZip(data.vehicle, data.photos)
    } catch (err) {
      toast({ title: 'Export failed', description: getErrorMessage(err) || err.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const vehicle = data?.vehicle ?? {}
  const photos = data?.photos ?? []
  const starredPhoto = (data?.vehiclePhotos ?? []).find((p) => p.isStarred) ?? (data?.vehiclePhotos ?? [])[0]
  const currentStatusId = data?.agentStatusId ?? ''
  // While a change is saving show the status being saved; otherwise the saved one ('' = none yet).
  const statusValue = statusMutation.isPending ? String(statusMutation.variables) : currentStatusId ? String(currentStatusId) : ''
  const vehicleRows = [
    ['Registration Number', vehicle.registrationNumber],
    ['Registration Date', vehicle.registrationDate ? formatDate(vehicle.registrationDate) : null],
    ['Make', vehicle.make],
    ['Model', vehicle.model],
    ['Chassis Number', vehicle.chassisNumber],
    ['Engine Number', vehicle.engineNumber],
    ['Vehicle Type', vehicle.vehicleType],
    ['Mfg. Month / Year', formatManufacture(vehicle.manufactureMonth, vehicle.manufactureYear)],
  ].filter(([, value]) => value)

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button
          variant="ghost"
          size="sm"
          className="mb-1 -ml-2 h-7 px-2 text-muted-foreground"
          onClick={() => navigate(backTo, { state: { dealerName } })}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <VehicleAvatar
              photoUrl={starredPhoto?.photoUrl}
              className="h-16 w-16"
              onClick={() => {
                const photos = data?.vehiclePhotos ?? []
                const idx = photos.findIndex((p) => p.isStarred)
                setAvatarIndex(idx >= 0 ? idx : 0)
                setAvatarPreviewOpen(true)
              }}
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">{vehicle.registrationNumber || 'Vehicle Process'}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="truncate">{dealerName}</span>
                {data?.processDate && <span>· Created {formatDate(data.processDate)}</span>}
                {data?.dealNumber && <span>· Deal No: {data.dealNumber}</span>}
              </div>
            </div>
          </div>
          {data && (
            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={statusValue}
                onValueChange={(value) => statusMutation.mutate(value)}
                disabled={statusMutation.isPending || statuses.length === 0}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.statusId} value={String(s.statusId)}>
                      <span className="flex items-center gap-2">
                        {s.colour && (
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-border"
                            style={{ backgroundColor: s.colour }}
                          />
                        )}
                        {s.statusName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete process">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Tags</span>
            <TagPicker processId={id} value={data.tags ?? []} dealerId={dealerId} />
          </div>
        )}
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <EmptyState title="Process not found" description="This process may have been removed or you don't manage this dealer." />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <AnimatedTabsList tabs={TABS} value={tab} layoutId="agent-process-tab" className="w-full" />

          {/* Tab 1 — Vehicle info & Deal */}
          <AnimatedTabPanel value="overview" className="space-y-6">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Vehicle</CardTitle>
                </div>
                {data?.vehicleId && (
                  <Button variant="outline" size="sm" onClick={() => setEditVehicle(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit details
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {vehicleRows.map(([label, value]) => (
                    <div key={label} className="flex flex-col">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <DealPricePanel processId={id} dealerId={dealerId} />
          </AnimatedTabPanel>

          {/* Tab 2 — Seller / Owner & Buyer (+ references) */}
          <AnimatedTabPanel value="persons" className="space-y-6">
            <PersonsPanel processId={id} dealerId={dealerId} stacked processDate={data?.processDate} processCreatedAt={data?.createdAt} />

            {(data.references?.seller || data.references?.buyer) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">References</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                  {data.references.seller && (
                    <Badge variant="outline">
                      Seller: {data.references.seller.referenceName} ({data.references.seller.referenceNumber})
                    </Badge>
                  )}
                  {data.references.buyer && (
                    <Badge variant="outline">
                      Buyer: {data.references.buyer.referenceName} ({data.references.buyer.referenceNumber})
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </AnimatedTabPanel>

          {/* Tab 3 — Tasks */}
          <AnimatedTabPanel value="tasks">
            <TasksPanel processId={id} dealerId={dealerId} />
          </AnimatedTabPanel>

          {/* Tab 4 — Expenses */}
          <AnimatedTabPanel value="expenses">
            <ExpensesPanel processId={id} dealerId={dealerId} />
          </AnimatedTabPanel>

          {/* Tab 5 — Documents (gallery + full-screen viewer) */}
          <AnimatedTabPanel value="documents">
            <DocumentsPanel
              photos={photos}
              processId={id}
              dealerId={dealerId}
              editable
              onExport={handleExport}
              exporting={exporting}
            />
          </AnimatedTabPanel>

          {/* Tab 6 — Vehicle photos (free-form, max 5) */}
          <AnimatedTabPanel value="vehicle-photos">
            <VehiclePhotosPanel vehiclePhotos={data.vehiclePhotos} processId={id} dealerId={dealerId} editable />
          </AnimatedTabPanel>

          {/* Tab 7 — RTO Receipt & RC Book */}
          <AnimatedTabPanel value="rto">
            <RtoReceiptPanel
              processId={id}
              receipt={data.receipt}
              trackingNumber={data.trackingNumber}
              canEdit
              invalidateKeys={[['vehicle-process', id, 'details']]}
            />
          </AnimatedTabPanel>
        </Tabs>
      )}

      <TypeConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete process"
        description="This moves the process to the Bin. Its persons, tasks, expenses, and documents are kept and it can be restored for 7 days, after which it is permanently purged."
        confirmWord="DELETE"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      {data && (
        <VehicleEditDialog
          open={editVehicle}
          onOpenChange={setEditVehicle}
          vehicle={data.vehicle}
          vehicleId={data.vehicleId}
        />
      )}

      {/* Preview of the profile (starred) photo — opened by clicking the header avatar. */}
      <PhotoGalleryDialog
        open={avatarPreviewOpen}
        onOpenChange={setAvatarPreviewOpen}
        photos={data?.vehiclePhotos ?? []}
        index={avatarIndex}
        onIndexChange={setAvatarIndex}
      />

      {/* Floating comments widget — shared thread with the dealer (chat popover). */}
      {data && <CommentsWidget processId={id} />}
    </div>
  )
}
