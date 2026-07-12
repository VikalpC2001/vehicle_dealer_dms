import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseValidationErrors } from '@/lib/authErrors'

const citySchema = z.object({
  stateId: z.string().min(1, 'Please select a state'),
  cityName: z.string().min(2, 'City name must be at least 2 characters'),
})

export function CityForm({ defaultValues, states = [], onSubmit, loading, submitLabel = 'Save City', lockState = false }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(citySchema),
    defaultValues: {
      stateId: defaultValues?.stateId ?? '',
      cityName: defaultValues?.cityName ?? '',
    },
  })

  const stateId = watch('stateId')

  useEffect(() => {
    reset({
      stateId: defaultValues?.stateId ?? '',
      cityName: defaultValues?.cityName ?? '',
    })
  }, [defaultValues, reset])

  const handleFormSubmit = async (values) => {
    try {
      await onSubmit(values)
    } catch (err) {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => {
        setError(field, { message })
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>State</Label>
        <Select
          value={stateId}
          onValueChange={(v) => setValue('stateId', v, { shouldValidate: true })}
          disabled={lockState}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            {states.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.stateName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.stateId && <p className="text-sm text-destructive">{errors.stateId.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cityName">City Name</Label>
        <Input id="cityName" placeholder="Mumbai" {...register('cityName')} />
        {errors.cityName && <p className="text-sm text-destructive">{errors.cityName.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={loading || states.length === 0}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : submitLabel}
      </Button>
    </form>
  )
}
