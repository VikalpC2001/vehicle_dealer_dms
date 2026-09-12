import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Car, FileText, Download, Loader2, Trash2 } from 'lucide-react'
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
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { Tabs } from '@/components/ui/tabs'
import { AnimatedTabsList, AnimatedTabPanel } from '@/components/common/AnimatedTabs'
import { DealPricePanel } from '@/components/vehicle-process/DealPricePanel'
import { ExpensesPanel } from '@/components/vehicle-process/ExpensesPanel'
import { PersonsPanel } from '@/components/vehicle-process/PersonsPanel'
import { TasksPanel } from '@/components/vehicle-process/TasksPanel'
import { RtoReceiptPanel } from '@/components/vehicle-process/RtoReceiptPanel'
import { PhotoGalleryDialog } from '@/components/vehicle-process/PhotoGalleryDialog'
import { CommentsWidget } from '@/components/vehicle-process/CommentsWidget'
import { TagPicker } from '@/components/vehicle-process/TagPicker'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { agentStatusService } from '@/services/agentStatusService'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDate } from '@/lib/utils'
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'
import { exportProcessImagesZip } from '@/lib/zip'
import { toast } from '@/hooks/use-toast'

const TABS = [
  { value: 'overview', label: 'Vehicle & Deal' },
  { value: 'persons', label: 'Seller & Buyer' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'documents', label: 'Documents' },
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
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
    onSuccess: () => {
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
      toast({ title: 'Process deleted', variant: 'success' })
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
  const currentStatusId = data?.agentStatusId ?? ''
  const vehicleRows = [
    ['Registration Number', vehicle.registrationNumber],
    ['Registration Date', vehicle.registrationDate ? formatDate(vehicle.registrationDate) : null],
    ['Make', vehicle.make],
    ['Model', vehicle.model],
    ['Chassis Number', vehicle.chassisNumber],
    ['Engine Number', vehicle.engineNumber],
    ['Vehicle Type', vehicle.vehicleType],
    ['Mfg. Month / Year', [vehicle.manufactureMonth, vehicle.manufactureYear].filter(Boolean).join(' / ')],
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
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{vehicle.registrationNumber || 'Vehicle Process'}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">{dealerName}</span>
              {data?.processDate && <span>· Created {formatDate(data.processDate)}</span>}
            </div>
          </div>
          {data && (
            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={currentStatusId ? String(currentStatusId) : undefined}
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
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Car className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Vehicle</CardTitle>
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
            <PersonsPanel processId={id} dealerId={dealerId} stacked />

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
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Documents ({photos.length})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={!photos.length || exporting}>
                  {exporting ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Exporting…</>
                  ) : (
                    <><Download className="mr-1.5 h-4 w-4" /> Export ZIP</>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {!photos.length ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {photos.map((photo, i) => (
                      <button
                        key={photo.processUploadPhotoId ?? photo.imageName}
                        type="button"
                        onClick={() => {
                          setGalleryIndex(i)
                          setGalleryOpen(true)
                        }}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30 transition hover:ring-2 hover:ring-primary"
                        aria-label={`View ${photo.category || 'document'}`}
                      >
                        {isPdfUrl(photo.photoUrl) ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                            <FileText className="h-8 w-8" />
                            <span className="text-[11px] font-medium">PDF</span>
                          </div>
                        ) : (
                          <img
                            src={toAppImageUrl(photo.photoUrl)}
                            alt={photo.category}
                            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                            loading="lazy"
                          />
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-left text-xs font-medium text-white">
                          {photo.category}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </AnimatedTabPanel>

          {/* Tab 6 — RTO Receipt & RC Book */}
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

      <PhotoGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        photos={photos}
        index={galleryIndex}
        onIndexChange={setGalleryIndex}
      />

      <ConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete process"
        description="This permanently removes the process and its persons, tasks, expenses, and documents. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      {/* Floating comments widget — shared thread with the dealer (chat popover). */}
      {data && <CommentsWidget processId={id} />}
    </div>
  )
}
