import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Car, User, Users, Building2 } from 'lucide-react'
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
import { Tabs } from '@/components/ui/tabs'
import { AnimatedTabsList, AnimatedTabPanel } from '@/components/common/AnimatedTabs'
import { DocumentsPanel } from '@/components/vehicle-process/DocumentsPanel'
import { VehiclePhotosPanel } from '@/components/vehicle-process/VehiclePhotosPanel'
import { CommentsWidget } from '@/components/vehicle-process/CommentsWidget'
import { RtoReceiptPanel } from '@/components/vehicle-process/RtoReceiptPanel'
import { TagChip } from '@/components/vehicle-process/TagChip'
import { processAssignmentService } from '@/services/processAssignmentService'
import { agentStatusService } from '@/services/agentStatusService'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDate } from '@/lib/utils'
import { exportProcessImagesZip } from '@/lib/zip'
import { toast } from '@/hooks/use-toast'

const TABS = [
  { value: 'vehicle', label: 'Vehicle & Persons' },
  { value: 'rto', label: 'RTO & RC Book' },
  { value: 'documents', label: 'Documents' },
  { value: 'vehicle-photos', label: 'Vehicle Photos' },
]

/** Read-only party card (seller/owner or buyer) — the agent views but cannot edit the dealer's persons. */
function PersonReadonlyCard({ title, icon: Icon, person }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {person ? (
          <div className="space-y-1">
            <p className="font-medium">{person.personName}</p>
            {person.mobileNumber && <p className="text-muted-foreground">{person.mobileNumber}</p>}
            {person.address && <p className="text-muted-foreground">{person.address}</p>}
          </div>
        ) : (
          <p className="text-muted-foreground">Not recorded.</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AgentAssignmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('vehicle')
  const [exporting, setExporting] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agent-assignment', id],
    queryFn: () => processAssignmentService.getDetails(id),
    enabled: Boolean(id),
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ['agent-statuses'],
    queryFn: () => agentStatusService.getAll(),
  })

  const statusMutation = useMutation({
    mutationFn: (agentStatusId) => processAssignmentService.updateAgentStatus(id, agentStatusId),
    // The saved status goes straight into the cache, so the dropdown shows it even if the refetch fails.
    onSuccess: (_data, agentStatusId) => {
      queryClient.setQueryData(['agent-assignment', id], (old) =>
        old && {
          ...old,
          assignment: {
            ...old.assignment,
            agentStatus: statuses.find((s) => String(s.statusId) === String(agentStatusId)) ?? { statusId: agentStatusId },
          },
        })
      queryClient.invalidateQueries({ queryKey: ['agent-assignment', id] })
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] })
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not change status', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const assignment = data?.assignment ?? {}
  const process = data?.process ?? {}
  const processTags = process.tags ?? []
  const dealer = data?.dealer ?? assignment?.process?.dealer ?? null
  const vehicle = process.vehicle ?? {}
  // The assignment's `process` is the VehicleProcessDetailsDto — it exposes the ACTIVE seller/buyer as
  // `owner`/`buyer` (not a `persons` array). Read-only for the agent on an assigned process.
  const sellerPerson = process.owner ?? null
  const buyerPerson = process.buyer ?? null
  const photos = process.photos ?? []
  const currentStatusId = assignment?.agentStatus?.statusId ?? ''
  // While a change is saving show the status being saved; otherwise the saved one ('' = none yet).
  const statusValue = statusMutation.isPending ? String(statusMutation.variables) : currentStatusId ? String(currentStatusId) : ''
  const serviceLabel = assignment?.service?.serviceName ?? assignment?.service?.shortName ?? 'RTO service'

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

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportProcessImagesZip(vehicle, photos)
    } catch (err) {
      toast({ title: 'Export failed', description: getErrorMessage(err) || err.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-7 px-2 text-muted-foreground" onClick={() => navigate('/agent/assignments')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{vehicle.registrationNumber || 'Assignment'}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {dealer && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {dealer.firmName ?? dealer.dealerName}
                </span>
              )}
              <Badge variant="outline" className="text-[11px]">{serviceLabel}</Badge>
            </div>
          </div>
          {data && (
            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={statusValue}
                onValueChange={(value) => statusMutation.mutate(value)}
                disabled={statusMutation.isPending}
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
            </div>
          )}
        </div>
        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Tags</span>
            {/* Read-only: an agent can't edit the dealer's tags on an assigned process. */}
            {processTags.length > 0 ? (
              processTags.map((t) => <TagChip key={t.tagId} name={t.tagName} colour={t.colour} />)
            ) : (
              <span className="text-sm text-muted-foreground">No tags</span>
            )}
          </div>
        )}
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <EmptyState title="Assignment not found" description="This assignment may have been removed or you don't have access." />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <AnimatedTabsList tabs={TABS} value={tab} layoutId="agent-assignment-tab" className="w-full" />

          {/* Tab 1 — Vehicle info & Persons */}
          <AnimatedTabPanel value="vehicle" className="space-y-6">
            <Card>
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Car className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                {vehicleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vehicle details available.</p>
                ) : (
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {vehicleRows.map(([label, value]) => (
                      <div key={label} className="flex flex-col">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="text-sm font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>

            {/* Seller & buyer — read-only (the agent views the dealer's parties but can't edit them). */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <PersonReadonlyCard title="Seller / Owner" icon={User} person={sellerPerson} />
              <PersonReadonlyCard title="Buyer" icon={Users} person={buyerPerson} />
            </div>
          </AnimatedTabPanel>

          {/* Tab 2 — RTO Receipt & RC Book */}
          <AnimatedTabPanel value="rto">
            {process.processId ? (
              <RtoReceiptPanel
                processId={process.processId}
                receipt={process.receipt}
                trackingNumber={process.trackingNumber}
                canEdit
                invalidateKeys={[['agent-assignment', id]]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Not available for this assignment.</p>
            )}
          </AnimatedTabPanel>

          {/* Tab 3 — Documents (gallery + full-screen viewer) */}
          <AnimatedTabPanel value="documents">
            <DocumentsPanel photos={photos} editable={false} onExport={handleExport} exporting={exporting} />
          </AnimatedTabPanel>

          {/* Tab 4 — Vehicle photos (read-only) */}
          <AnimatedTabPanel value="vehicle-photos">
            <VehiclePhotosPanel vehiclePhotos={process.vehiclePhotos} editable={false} />
          </AnimatedTabPanel>
        </Tabs>
      )}

      {/* Floating comments widget — shared thread with the dealer (chat popover). */}
      {process.processId && <CommentsWidget processId={process.processId} />}
    </div>
  )
}
