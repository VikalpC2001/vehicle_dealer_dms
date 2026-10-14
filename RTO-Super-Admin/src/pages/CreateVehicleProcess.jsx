import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VehicleProcessWizard } from '@/components/vehicle-process/VehicleProcessWizard'
import { ProcessCreatedScreen } from '@/components/vehicle-process/ProcessCreatedScreen'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/** Vehicle fields from the submitted start payload, for the success screen. */
function vehicleFromPayload(p = {}) {
  return {
    registrationNumber: p.registrationNumber,
    make: p.make,
    model: p.model,
    vehicleType: p.vehicleType,
    chassisNumber: p.chassisNumber,
    engineNumber: p.engineNumber,
    registrationDate: p.registrationDate,
    manufactureMonth: p.manufactureMonth,
    manufactureYear: p.manufactureYear,
  }
}

export default function CreateVehicleProcess() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [created, setCreated] = useState(null)
  const [wizardKey, setWizardKey] = useState(0)

  const createMutation = useMutation({
    mutationFn: (payload) => vehicleProcessService.start(payload),
    onSuccess: (data, payload) => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      const id = getProcessId(data?.process ?? data)
      setCreated({ id, vehicle: vehicleFromPayload(payload) })
    },
    onError: (err) => {
      toast({ title: 'Could not create process', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  if (created) {
    return (
      <ProcessCreatedScreen
        vehicle={created.vehicle}
        onAddNew={() => {
          setCreated(null)
          setWizardKey((k) => k + 1) // fresh wizard
        }}
        onViewDetails={() =>
          navigate(created.id ? `/dealer/processes/${created.id}` : '/dealer/processes')
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/dealer/processes')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to processes
        </Button>
        <h1 className="text-3xl font-bold">New Vehicle Process</h1>
        <p className="text-muted-foreground mt-1">
          Upload the documents, verify the auto-filled details, and create the process.
        </p>
      </motion.div>

      <Card>
        <CardContent className="p-6">
          <VehicleProcessWizard
            key={wizardKey}
            onSubmit={(payload) => createMutation.mutateAsync(payload)}
            submitting={createMutation.isPending}
            onCancel={() => navigate('/dealer/processes')}
          />
        </CardContent>
      </Card>
    </div>
  )
}
