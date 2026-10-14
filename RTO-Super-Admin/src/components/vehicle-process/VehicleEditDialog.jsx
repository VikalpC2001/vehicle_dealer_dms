import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { vehicleService } from '@/services/vehicleService'
import { getErrorMessage, parseValidationErrors } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/** Optional whole-number field constrained to a range (empty is allowed). */
const numberInRange = (min, max, message) =>
  z
    .string()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), message)
    .optional()
    .or(z.literal(''))

const vehicleEditSchema = z.object({
  make: z.string().max(100).optional().or(z.literal('')),
  model: z.string().max(100).optional().or(z.literal('')),
  vehicleType: z.string().max(50).optional().or(z.literal('')),
  chassisNumber: z.string().max(100).optional().or(z.literal('')),
  engineNumber: z.string().max(100).optional().or(z.literal('')),
  registrationDate: z.string().optional().or(z.literal('')),
  manufactureMonth: numberInRange(1, 12, 'Enter a month between 1 and 12'),
  manufactureYear: numberInRange(1900, 3000, 'Enter a year between 1900 and 3000'),
})

const defaultVehicleEditValues = {
  make: '',
  model: '',
  vehicleType: '',
  chassisNumber: '',
  engineNumber: '',
  registrationDate: '',
  manufactureMonth: '',
  manufactureYear: '',
}

/** Seeds the form from the embedded vehicle object (date sliced to yyyy-mm-dd, numbers stringified). */
function mapVehicleToForm(vehicle) {
  if (!vehicle) return defaultVehicleEditValues
  return {
    make: vehicle.make ?? '',
    model: vehicle.model ?? '',
    vehicleType: vehicle.vehicleType ?? '',
    chassisNumber: vehicle.chassisNumber ?? '',
    engineNumber: vehicle.engineNumber ?? '',
    registrationDate: vehicle.registrationDate ? String(vehicle.registrationDate).slice(0, 10) : '',
    manufactureMonth: String(vehicle.manufactureMonth ?? ''),
    manufactureYear: String(vehicle.manufactureYear ?? ''),
  }
}

/**
 * Edit the vehicle attached to a process. Registration number is shown read-only (not editable).
 * PATCH /vehicles/:id is a FULL-REPLACE, so submit rebuilds the complete body (unchanged
 * registrationNumber passed through; blanks → null; month/year coerced to Number()).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object} props.vehicle - the embedded vehicle object from the process details response
 * @param {string} props.vehicleId
 */
export function VehicleEditDialog({ open, onOpenChange, vehicle, vehicleId }) {
  const queryClient = useQueryClient()
  const formValues = useMemo(() => mapVehicleToForm(vehicle), [vehicle])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(vehicleEditSchema),
    defaultValues: formValues,
  })

  // Re-seed from the persisted vehicle every time the dialog OPENS. The dialog stays mounted across
  // close/reopen, so without this RHF would keep abandoned/cancelled edits (and let them be re-saved).
  // Keyed on `open` only — NOT `vehicle` — so a background refetch mid-edit can't wipe in-progress input.
  useEffect(() => {
    if (open) reset(mapVehicleToForm(vehicle))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const mutation = useMutation({
    mutationFn: (body) => vehicleService.update(vehicleId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-process'] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      toast({ title: 'Vehicle updated', variant: 'success' })
      onOpenChange(false)
    },
    onError: (err) => {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
      toast({ title: 'Could not update vehicle', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const onSubmit = (values) => {
    const body = {
      registrationNumber: vehicle?.registrationNumber,
      chassisNumber: values.chassisNumber.trim() || null,
      engineNumber: values.engineNumber.trim() || null,
      vehicleType: values.vehicleType.trim() || null,
      make: values.make.trim() || null,
      model: values.model.trim() || null,
      registrationDate: values.registrationDate || null,
      manufactureMonth: values.manufactureMonth === '' ? null : Number(values.manufactureMonth),
      manufactureYear: values.manufactureYear === '' ? null : Number(values.manufactureYear),
    }
    mutation.mutate(body)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit vehicle details</DialogTitle>
          <DialogDescription>
            Update the vehicle information. The registration number cannot be changed here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Registration Number" id="registrationNumber">
              <Input id="registrationNumber" value={vehicle?.registrationNumber ?? ''} disabled readOnly />
            </Field>
            <Field label="Registration Date" id="registrationDate" error={errors.registrationDate?.message}>
              <Input id="registrationDate" type="date" {...register('registrationDate')} />
            </Field>
            <Field label="Make" id="make" error={errors.make?.message}>
              <Input id="make" placeholder="Maruti" {...register('make')} />
            </Field>
            <Field label="Model" id="model" error={errors.model?.message}>
              <Input id="model" placeholder="Swift" {...register('model')} />
            </Field>
            <Field label="Chassis Number" id="chassisNumber" error={errors.chassisNumber?.message}>
              <Input id="chassisNumber" placeholder="MBLJF16EDCGA07285" {...register('chassisNumber')} />
            </Field>
            <Field label="Engine Number" id="engineNumber" error={errors.engineNumber?.message}>
              <Input id="engineNumber" placeholder="JF16EBCGA06004" {...register('engineNumber')} />
            </Field>
            <Field label="Vehicle Type" id="vehicleType" error={errors.vehicleType?.message}>
              <Input id="vehicleType" placeholder="Car / Scooter" {...register('vehicleType')} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mfg. Month" id="manufactureMonth" error={errors.manufactureMonth?.message}>
                <Input
                  id="manufactureMonth"
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="6"
                  {...register('manufactureMonth', {
                    onChange: (e) => {
                      // digits only, 1-2 digits (month)
                      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2)
                    },
                  })}
                />
              </Field>
              <Field label="Mfg. Year" id="manufactureYear" error={errors.manufactureYear?.message}>
                <Input
                  id="manufactureYear"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="2019"
                  {...register('manufactureYear', {
                    onChange: (e) => {
                      // digits only, 4 digits (year)
                      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4)
                    },
                  })}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, id, error, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
