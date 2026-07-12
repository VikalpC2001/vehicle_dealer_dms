import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Car, FileText, Users, Building2 } from 'lucide-react'
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
import { processAssignmentService } from '@/services/processAssignmentService'
import { agentStatusService } from '@/services/agentStatusService'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDate } from '@/lib/utils'
import { toAppImageUrl } from '@/lib/vehicleProcess'
import { toast } from '@/hooks/use-toast'

export default function AgentAssignmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-assignment', id] })
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] })
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not change status', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const assignment = data?.assignment ?? {}
  const process = data?.process ?? {}
  const dealer = data?.dealer ?? assignment?.process?.dealer ?? null
  const vehicle = process.vehicle ?? {}
  const persons = process.persons ?? []
  const photos = process.photos ?? []
  const currentStatusId = assignment?.agentStatus?.statusId ?? ''
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

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/agent/assignments')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to assignments
        </Button>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{vehicle.registrationNumber || 'Assignment'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {dealer && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {dealer.firmName ?? dealer.dealerName}
                </span>
              )}
              <Badge variant="outline">{serviceLabel}</Badge>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-2">
              <Select
                value={currentStatusId ? String(currentStatusId) : undefined}
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
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <EmptyState title="Assignment not found" description="This assignment may have been removed or you don't have access." />
      ) : (
        <>
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

          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Persons ({persons.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {persons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No persons recorded.</p>
              ) : (
                <div className="divide-y divide-border">
                  {persons.map((person) => (
                    <div
                      key={person.personId ?? `${person.personType}-${person.personName}`}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{person.personName}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {person.mobileNumber && <span>{person.mobileNumber}</span>}
                          {person.address && <span className="truncate">{person.address}</span>}
                        </div>
                      </div>
                      {person.personType && <Badge variant="outline">{person.personType}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Documents ({photos.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((photo) => (
                    <figure key={photo.processUploadPhotoId ?? photo.imageName} className="space-y-1">
                      <a href={toAppImageUrl(photo.photoUrl)} target="_blank" rel="noreferrer">
                        <img
                          src={toAppImageUrl(photo.photoUrl)}
                          alt={photo.category}
                          className="h-28 w-full rounded-md border border-border object-cover transition-opacity hover:opacity-90"
                        />
                      </a>
                      <figcaption className="truncate text-xs text-muted-foreground">{photo.category}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
