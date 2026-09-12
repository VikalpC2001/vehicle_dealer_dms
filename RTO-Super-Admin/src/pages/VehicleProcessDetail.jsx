import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Car, FileText, Trash2, Download, Loader2 } from 'lucide-react'
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
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { PersonsPanel } from '@/components/vehicle-process/PersonsPanel'
import { DealPricePanel } from '@/components/vehicle-process/DealPricePanel'
import { ExpensesPanel } from '@/components/vehicle-process/ExpensesPanel'
import { TasksPanel } from '@/components/vehicle-process/TasksPanel'
import { AssignAgentPanel } from '@/components/vehicle-process/AssignAgentPanel'
import { CommentsWidget } from '@/components/vehicle-process/CommentsWidget'
import { RtoReceiptPanel } from '@/components/vehicle-process/RtoReceiptPanel'
import { PhotoGalleryDialog } from '@/components/vehicle-process/PhotoGalleryDialog'
import { VehicleHistoryPanel } from '@/components/vehicle-process/VehicleHistoryPanel'
import { TagPicker } from '@/components/vehicle-process/TagPicker'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { PROCESS_STATUSES } from '@/lib/processStatus'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDate } from '@/lib/utils'
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'
import { exportProcessImagesZip } from '@/lib/zip'
import { toast } from '@/hooks/use-toast'

/** Select sentinel for the status-less (OPEN) state — maps to `null` on the wire. */
const STATUS_OPEN = '__open__'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'persons', label: 'Seller & Buyer' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'documents', label: 'Documents' },
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
  const [exporting, setExporting] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [tab, setTab] = useState('overview')
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
      toast({ title: 'Process deleted', variant: 'success' })
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
    <div className="space-y-6 xl:flex xl:h-[calc(100vh-72px-4rem)] xl:flex-col xl:space-y-0 xl:gap-6">
      <motion.div className="xl:shrink-0" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button
          variant="ghost"
          size="sm"
          className="mb-1 -ml-2 h-7 px-2 text-muted-foreground"
          onClick={() => navigate('/dealer/processes')}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-xl font-bold">{vehicle.registrationNumber || 'Vehicle Process'}</h1>
            {data?.processDate && (
              <span className="whitespace-nowrap text-xs text-muted-foreground">Created {formatDate(data.processDate)}</span>
            )}
          </div>
          {data && (
            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={data.status ?? STATUS_OPEN}
                onValueChange={(v) => statusMutation.mutate(v === STATUS_OPEN ? null : v)}
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

              <DealPricePanel processId={id} />
            </TabPanel>

            {/* Tab 2 — Seller / Owner & Buyer (+ references) */}
            <TabPanel value="persons" className="space-y-6">
              <PersonsPanel processId={id} stacked />

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
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Documents ({data.photos?.length ?? 0})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={!data.photos?.length || exporting}
                  >
                    {exporting ? (
                      <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Exporting…</>
                    ) : (
                      <><Download className="mr-1.5 h-4 w-4" /> Export ZIP</>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {!data.photos?.length ? (
                    <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {data.photos.map((photo, i) => (
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
            </TabPanel>

            {/* Tab 6 — RTO Receipt & RC Book & Assign to Agent */}
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

            {/* Tab 7 — Vehicle history (buy/sell timeline across processes for this registration) */}
            <TabPanel value="history">
              <VehicleHistoryPanel registrationNumber={vehicle.registrationNumber} currentProcessId={id} />
            </TabPanel>
            </div>
          </Tabs>
        </div>
      )}

      <PhotoGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        photos={data?.photos ?? []}
        index={galleryIndex}
        onIndexChange={setGalleryIndex}
      />

      <ConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete process"
        description="This permanently removes the process and its tasks, persons, and documents. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      {/* Floating comments widget — chat popover that pops from a button in the corner. */}
      {data && <CommentsWidget processId={id} />}
    </div>
  )
}
