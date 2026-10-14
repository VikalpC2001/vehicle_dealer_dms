import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Car, Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/common/EmptyState'
import { TypeConfirmModal } from '@/components/modals/TypeConfirmModal'
import { PersonsPanel } from '@/components/vehicle-process/PersonsPanel'
import { DealPricePanel } from '@/components/vehicle-process/DealPricePanel'
import { ExpensesPanel } from '@/components/vehicle-process/ExpensesPanel'
import { TasksPanel } from '@/components/vehicle-process/TasksPanel'
import { AssignAgentPanel } from '@/components/vehicle-process/AssignAgentPanel'
import { CommentsWidget } from '@/components/vehicle-process/CommentsWidget'
import { RtoReceiptPanel } from '@/components/vehicle-process/RtoReceiptPanel'
import { DocumentsPanel } from '@/components/vehicle-process/DocumentsPanel'
import { VehiclePhotosPanel } from '@/components/vehicle-process/VehiclePhotosPanel'
import { VehicleHistoryPanel } from '@/components/vehicle-process/VehicleHistoryPanel'
import { VehicleEditDialog } from '@/components/vehicle-process/VehicleEditDialog'
import { TagPicker } from '@/components/vehicle-process/TagPicker'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { personService } from '@/services/personService'
import { PROCESS_STATUSES } from '@/lib/processStatus'
import { VehicleAvatar } from '@/components/vehicle-process/VehicleAvatar'
import { PhotoGalleryDialog } from '@/components/vehicle-process/PhotoGalleryDialog'
import { PersonFormDialog } from '@/components/vehicle-process/PersonFormDialog'
import { getErrorMessage, parseValidationErrors } from '@/lib/authErrors'
import { formatDate, formatManufacture } from '@/lib/utils'
import { exportProcessImagesZip } from '@/lib/zip'
import { toast } from '@/hooks/use-toast'

/** Select sentinel for the status-less (OPEN) state — maps to `null` on the wire. */
const STATUS_OPEN = '__open__'

/** Formats a date value to the local `YYYY-MM-DD` an `<input type="date">` expects. */
const toDateInput = (value) => {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'persons', label: 'Seller & Buyer' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'documents', label: 'Documents' },
  { value: 'vehicle-photos', label: 'Vehicle Photos' },
  { value: 'rto', label: 'RTO & Agent' },
  { value: 'history', label: 'History' },
]

/**
 * Tab body that fades + slides in on activation. Radix remounts a tab's content each time it
 * becomes active, so this enter animation replays on every tab change.
 */
function TabPanel({ value, className, children }) {
  const reduce = useReducedMotion()
  return (
    <TabsContent value={value}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </TabsContent>
  )
}

export default function VehicleProcessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editVehicle, setEditVehicle] = useState(false)
  const [exporting, setExporting] = useState(false)
  // A link may ask for a tab through navigation state (the agent-work list opens "RTO & Agent").
  const { state: navState } = useLocation()
  const [tab, setTab] = useState(() => (TABS.some((t) => t.value === navState?.tab) ? navState.tab : 'overview'))
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)
  const [avatarIndex, setAvatarIndex] = useState(0)
  // OPEN→SOLD flow: when no buyer exists we open a buyer form which, on success, shows the Sold
  // success animation in-place (same dialog) and marks the process Sold.
  const [buyerFormOpen, setBuyerFormOpen] = useState(false)
  const [personNonce, setPersonNonce] = useState(0) // bump → remount the buyer form fresh per open
  const [editingSoldDate, setEditingSoldDate] = useState(false)
  const [soldDateDraft, setSoldDateDraft] = useState('')
  const reduceMotion = useReducedMotion()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle-process', id, 'details'],
    queryFn: () => vehicleProcessService.getDetails(id),
    enabled: Boolean(id),
  })

  const deleteMutation = useMutation({
    mutationFn: () => vehicleProcessService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      toast({ title: 'Process moved to Bin', variant: 'success' })
      navigate('/dealer/processes')
    },
    onError: (err) => toast({ title: 'Could not delete', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const statusMutation = useMutation({
    mutationFn: (status) => vehicleProcessService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', id] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not update status', description: getErrorMessage(err), variant: 'destructive' }),
  })

  // OPEN→SOLD with no buyer: add the buyer AND mark Sold as ONE awaited unit, so the in-dialog success
  // animation only appears when BOTH succeed (a failed SOLD never falsely celebrates). The buyer dialog
  // awaits this via onSubmit; it stays open and crossfades to the success phase on resolve.
  const sellMutation = useMutation({
    mutationFn: async (values) => {
      await personService.create({ processId: id, ...values })
      await vehicleProcessService.updateStatus(id, 'SOLD')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', id] })
      queryClient.invalidateQueries({ queryKey: ['persons', id] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
    },
    onError: (err) => {
      // Refresh persons/detail — the buyer may already have been created before the SOLD PATCH failed.
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', id] })
      queryClient.invalidateQueries({ queryKey: ['persons', id] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      // A field-validation error (422) means the buyer wasn't created — keep the dialog open so its
      // inline field errors show. Any OTHER failure (notably: the buyer WAS created but the SOLD PATCH
      // failed) would trap the user, since resubmitting re-POSTs the buyer → duplicate-buyer 4064. So
      // close the dialog; the invalidate above refreshes data.buyer, and re-picking SOLD then takes
      // the direct (buyer-already-exists) path straight to statusMutation.
      if (Object.keys(parseValidationErrors(err)).length === 0) setBuyerFormOpen(false)
      toast({ title: 'Could not mark as Sold', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  // Edit the recorded sold date of a sold process (inline editor beside the header "Sold" chip).
  const soldDateMutation = useMutation({
    mutationFn: (soldDate) => vehicleProcessService.updateSoldDate(id, soldDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', id] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      setEditingSoldDate(false)
      toast({ title: 'Sold date updated', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not update sold date', description: getErrorMessage(err), variant: 'destructive' }),
  })

  // OPEN→SOLD: if the process already has an active buyer, set Sold directly; otherwise prompt to add
  // a buyer first (adding it then auto-marks Sold with a success animation). Other statuses pass through.
  const handleStatusChange = (value) => {
    const next = value === STATUS_OPEN ? null : value
    if (next === 'SOLD' && !data?.buyer) {
      setPersonNonce((n) => n + 1)
      setBuyerFormOpen(true)
      return
    }
    statusMutation.mutate(next)
  }

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
  const starredPhoto = (data?.vehiclePhotos ?? []).find((p) => p.isStarred) ?? (data?.vehiclePhotos ?? [])[0]
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
    <div className="space-y-6 xl:flex xl:h-[calc(100vh-72px-4rem)] xl:flex-col xl:space-y-0 xl:gap-6">
      <motion.div className="xl:shrink-0" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button
          variant="ghost"
          size="sm"
          className="mb-1 -ml-2 h-7 px-2 text-muted-foreground"
          // Opened from another dealer page (an agent's work list)? Go back there; otherwise to the list.
          onClick={() =>
            navigate(typeof navState?.from === 'string' && navState.from.startsWith('/dealer/') ? navState.from : '/dealer/processes')
          }
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
            <h1 className="truncate text-xl font-bold">{vehicle.registrationNumber || 'Vehicle Process'}</h1>
            {data?.processDate && (
              <span className="whitespace-nowrap text-xs text-muted-foreground">Created {formatDate(data.processDate)}</span>
            )}
            {data?.dealNumber && (
              <span className="whitespace-nowrap text-xs text-muted-foreground">Deal No: {data.dealNumber}</span>
            )}
            {data?.soldDate &&
              (editingSoldDate ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    type="date"
                    value={soldDateDraft}
                    onChange={(e) => setSoldDateDraft(e.target.value)}
                    className="h-6 rounded border border-border bg-background px-1.5 text-xs text-foreground"
                    aria-label="Sold date"
                  />
                  <button
                    type="button"
                    aria-label="Save sold date"
                    disabled={!soldDateDraft || soldDateMutation.isPending}
                    onClick={() => soldDateMutation.mutate(new Date(`${soldDateDraft}T12:00:00`).toISOString())}
                    className="text-success disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel editing sold date"
                    onClick={() => setEditingSoldDate(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-success">
                  Sold {formatDate(data.soldDate)}
                  <button
                    type="button"
                    aria-label="Edit sold date"
                    onClick={() => {
                      setSoldDateDraft(toDateInput(data.soldDate))
                      setEditingSoldDate(true)
                    }}
                    className="text-success/80 hover:text-success"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </span>
              ))}
          </div>
          {data && (
            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={data.status ?? STATUS_OPEN}
                onValueChange={handleStatusChange}
                disabled={statusMutation.isPending}
              >
                <SelectTrigger className="w-36" aria-label="Process status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_OPEN}>Open</SelectItem>
                  {PROCESS_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
            <TagPicker processId={id} value={data.tags ?? []} />
          </div>
        )}
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <EmptyState title="Process not found" description="This process may have been removed or you don't have access." />
      ) : (
        <div className="min-w-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
          <Tabs value={tab} onValueChange={setTab} className="space-y-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:gap-4 xl:space-y-0">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 xl:shrink-0">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="relative data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:hover:text-foreground"
                >
                  {/* Sliding blue pill carries its own white label, so the active text is always
                      white-on-blue — no white-on-muted flash while the pill is mid-slide. */}
                  {tab === t.value && (
                    <motion.span
                      layoutId="vp-tab-indicator"
                      aria-hidden="true"
                      className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm"
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                    >
                      {t.label}
                    </motion.span>
                  )}
                  {/* Base label stays readable on the muted track (dark, not white). */}
                  <span>{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Scrollable content — the tab bar (above) stays fixed; only this region scrolls on
                xl+. Below xl it flows normally (the whole page scrolls). */}
            <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">

            {/* Tab 1 — Vehicle info & Deal */}
            <TabPanel value="overview" className="space-y-6">
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

              <DealPricePanel processId={id} />
            </TabPanel>

            {/* Tab 2 — Seller / Owner & Buyer (+ references) */}
            <TabPanel value="persons" className="space-y-6">
              <PersonsPanel processId={id} stacked processDate={data?.processDate} processCreatedAt={data?.createdAt} />

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
            </TabPanel>

            {/* Tab 3 — Tasks */}
            <TabPanel value="tasks">
              <TasksPanel processId={id} />
            </TabPanel>

            {/* Tab 4 — Expenses */}
            <TabPanel value="expenses">
              <ExpensesPanel processId={id} />
            </TabPanel>

            {/* Tab 5 — Documents */}
            <TabPanel value="documents">
              <DocumentsPanel
                photos={data.photos}
                processId={id}
                editable
                onExport={handleExport}
                exporting={exporting}
              />
            </TabPanel>

            {/* Tab 6 — Vehicle photos (free-form, max 5) */}
            <TabPanel value="vehicle-photos">
              <VehiclePhotosPanel vehiclePhotos={data.vehiclePhotos} processId={id} editable />
            </TabPanel>

            {/* Tab 7 — RTO Receipt & RC Book & Assign to Agent */}
            <TabPanel value="rto" className="space-y-6">
              <AssignAgentPanel processId={id} />
              <RtoReceiptPanel
                processId={id}
                receipt={data.receipt}
                trackingNumber={data.trackingNumber}
                canEdit={false}
                invalidateKeys={[['vehicle-process', id, 'details']]}
              />
            </TabPanel>

            {/* Tab 8 — Vehicle history (buy/sell timeline across processes for this registration) */}
            <TabPanel value="history">
              <VehicleHistoryPanel registrationNumber={vehicle.registrationNumber} currentProcessId={id} />
            </TabPanel>
            </div>
          </Tabs>
        </div>
      )}

      <TypeConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete process"
        description="This moves the process to the Bin. Its tasks, persons, and documents are kept and it can be restored for 7 days, after which it is permanently purged."
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

      {/* Add-buyer prompt shown when marking OPEN→SOLD without a buyer; adding one then marks Sold. */}
      <PersonFormDialog
        key={personNonce}
        open={buyerFormOpen}
        onOpenChange={(next) => !next && setBuyerFormOpen(false)}
        title="Add buyer to mark as Sold"
        defaultValues={{ personType: 'BUYER' }}
        lockType
        submitLabel="Add buyer & mark Sold"
        loading={sellMutation.isPending}
        onSubmit={(values) => sellMutation.mutateAsync(values)}
        successView
        successTitle="Marked as Sold"
        successDescription="Buyer added and the vehicle is now Sold."
        onDone={() => setBuyerFormOpen(false)}
      />

      {/* Floating comments widget — chat popover that pops from a button in the corner. */}
      {data && <CommentsWidget processId={id} />}
    </div>
  )
}
