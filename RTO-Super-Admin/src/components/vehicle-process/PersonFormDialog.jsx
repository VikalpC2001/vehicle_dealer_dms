import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseValidationErrors } from '@/lib/authErrors'
import { IdProofAutofill } from './IdProofAutofill'

export const personSchema = z.object({
  personName: z.string().min(1, 'Name is required').max(255),
  mobileNumber: z.string().min(1, 'Mobile number is required').max(20),
  address: z.string().optional().or(z.literal('')),
  personType: z.enum(['SELLER', 'BUYER']),
})

export const defaultPersonValues = {
  personName: '',
  mobileNumber: '',
  address: '',
  personType: 'BUYER',
}

/**
 * Add/edit a buyer or seller. Submits `{ personName, mobileNumber, address, personType }`.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {object} [props.defaultValues]
 * @param {boolean} [props.lockType] - Disable the SELLER/BUYER switch (e.g. "Add buyer").
 * @param {(values: object) => Promise<void>} props.onSubmit
 * @param {boolean} [props.loading]
 * @param {string} [props.submitLabel]
 */
export function PersonFormDialog({
  open,
  onOpenChange,
  title,
  defaultValues,
  lockType = false,
  onSubmit,
  loading,
  submitLabel = 'Save',
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(personSchema),
    defaultValues: { ...defaultPersonValues, ...defaultValues },
  })

  useEffect(() => {
    reset({ ...defaultPersonValues, ...defaultValues })
  }, [defaultValues, reset, open])

  const personType = watch('personType')

  const handleFormSubmit = async (values) => {
    try {
      await onSubmit({ ...values, address: values.address?.trim() || null })
    } catch (err) {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Buyer and seller details for this process.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">Have an ID? Auto-fill name &amp; address.</span>
            <IdProofAutofill
              onExtracted={({ name, address }) => {
                if (name) setValue('personName', name, { shouldDirty: true })
                if (address) setValue('address', address, { shouldDirty: true })
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personType">Type</Label>
            <Select
              value={personType}
              onValueChange={(v) => setValue('personType', v)}
              disabled={lockType}
            >
              <SelectTrigger id="personType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SELLER">Seller</SelectItem>
                <SelectItem value="BUYER">Buyer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="personName">Name</Label>
            <Input id="personName" placeholder="Full name" {...register('personName')} />
            {errors.personName && <p className="text-sm text-destructive">{errors.personName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobileNumber">Mobile Number</Label>
            <Input id="mobileNumber" placeholder="9876543210" {...register('mobileNumber')} />
            {errors.mobileNumber && <p className="text-sm text-destructive">{errors.mobileNumber.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" placeholder="Address (optional)" {...register('address')} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
