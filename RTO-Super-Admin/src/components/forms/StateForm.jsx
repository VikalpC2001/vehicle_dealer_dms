import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseValidationErrors } from '@/lib/authErrors'

const stateSchema = z.object({
  stateName: z.string().min(2, 'State name must be at least 2 characters'),
})

export function StateForm({ defaultValues, onSubmit, loading, submitLabel = 'Save State' }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(stateSchema),
    defaultValues: { stateName: defaultValues?.stateName ?? '' },
  })

  useEffect(() => {
    reset({ stateName: defaultValues?.stateName ?? '' })
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
        <Label htmlFor="stateName">State Name</Label>
        <Input id="stateName" placeholder="Maharashtra" {...register('stateName')} />
        {errors.stateName && <p className="text-sm text-destructive">{errors.stateName.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : submitLabel}
      </Button>
    </form>
  )
}
