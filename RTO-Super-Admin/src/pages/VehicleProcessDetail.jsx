import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Car, FileText, Trash2, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { ProcessStatusSelect } from '@/components/vehicle-process/ProcessStatusSelect'
import { PersonsPanel } from '@/components/vehicle-process/PersonsPanel'
import { DealPricePanel } from '@/components/vehicle-process/DealPricePanel'
import { ExpensesPanel } from '@/components/vehicle-process/ExpensesPanel'
import { TasksPanel } from '@/components/vehicle-process/TasksPanel'
import { AssignAgentPanel } from '@/components/vehicle-process/AssignAgentPanel'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { dealerStatusService } from '@/services/dealerStatusService'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDate } from '@/lib/utils'
import { toAppImageUrl } from '@/lib/vehicleProcess'
import { exportProcessImagesZip } from '@/lib/zip'
import { toast } from '@/hooks/use-toast'

export default function VehicleProcessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle-process', id, 'details'],
    queryFn: () => vehicleProcessService.getDetails(id),
    enabled: Boolean(id),
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ['dealer-statuses'],
    queryFn: () => dealerStatusService.getAll(),
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => vehicleProcessService.updateStatus(id, newStatus),
    onSuccess: () => {
      // Parent key: prefix-invalidates both the getById (Deal card) and '…details' queries.
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', id] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not change status', description: getErrorMessage(err), variant: 'destructive' }),
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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/dealer/processes')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to processes
        </Button>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{vehicle.registrationNumber || 'Vehicle Process'}</h1>
            {data?.processDate && (
              <p className="text-muted-foreground mt-1">Created {formatDate(data.processDate)}</p>
            )}
          </div>
          {data && (
            <div className="flex items-center gap-2">
              <ProcessStatusSelect
                value={data.status}
                statuses={statuses}
                onChange={(s) => statusMutation.mutate(s)}
                disabled={statusMutation.isPending}
              />
              <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete process">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
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
        <EmptyState title="Process not found" description="This process may have been removed or you don't have access." />
      ) : (
        <>
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

          <ExpensesPanel processId={id} />

          <PersonsPanel processId={id} />
          <TasksPanel processId={id} />
          <AssignAgentPanel processId={id} />

          {(data.references?.seller || data.references?.buyer) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">References:</span>
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
            </div>
          )}

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
                  {data.photos.map((photo) => (
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
    </div>
  )
}
