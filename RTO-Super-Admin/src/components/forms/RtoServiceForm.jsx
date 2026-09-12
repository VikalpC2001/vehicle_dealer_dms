import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseValidationErrors } from '@/lib/authErrors'

const rtoServiceSchema = z.object({
  serviceName: z.string().min(2, 'Service name must be at least 2 characters').max(255),
  shortName: z.string().min(1, 'Short name is required').max(50),
})

export function RtoServiceForm({ defaultValues, onSubmit, loading, submitLabel = 'Save Service' }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(rtoServiceSchema),
    defaultValues: {
      serviceName: defaultValues?.serviceName ?? '',
      shortName: defaultValues?.shortName ?? '',
    },
  })

  useEffect(() => {
    reset({
      serviceName: defaultValues?.serviceName ?? '',
      shortName: defaultValues?.shortName ?? '',
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
        <Label htmlFor="serviceName">Service Name</Label>
        <Input id="serviceName" placeholder="Name Transfer" {...register('serviceName')} />
        {errors.serviceName && <p className="text-sm text-destructive">{errors.serviceName.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="shortName">Short Name</Label>
        <Input id="shortName" placeholder="NT" maxLength={50} {...register('shortName')} />
        {errors.shortName && <p className="text-sm text-destructive">{errors.shortName.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : submitLabel}
      </Button>
    </form>
  )
}
