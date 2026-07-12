import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseValidationErrors } from '@/lib/authErrors'

const amountPattern = /^\d+(\.\d{1,2})?$/

export const expenseSchema = z.object({
  label: z.string().min(1, 'Label is required').max(255),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => amountPattern.test(v.trim()) && Number(v) > 0, 'Enter a valid amount (up to 2 decimals)'),
  category: z.string().max(50).optional().or(z.literal('')),
})

export const defaultExpenseValues = { label: '', amount: '', category: '' }

/**
 * Add/edit dialog for a single process expense (label + amount + optional category).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {object} [props.defaultValues]
 * @param {(values: object) => Promise<void>} props.onSubmit
 * @param {boolean} props.loading
 * @param {string} [props.submitLabel]
 */
export function ExpenseFormDialog({ open, onOpenChange, title, defaultValues, onSubmit, loading, submitLabel = 'Save' }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: { ...defaultExpenseValues, ...defaultValues },
  })

  useEffect(() => {
    reset({ ...defaultExpenseValues, ...defaultValues })
  }, [defaultValues, reset, open])

  const handleFormSubmit = async (values) => {
    try {
      await onSubmit(values)
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
          <DialogDescription>Record a cost for this process (e.g. RTO fee, repair, commission).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-label">Label</Label>
            <Input id="expense-label" placeholder="e.g. RTO name-transfer fee" {...register('label')} />
            {errors.label && <p className="text-sm text-destructive">{errors.label.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount (₹)</Label>
              <Input id="expense-amount" type="number" min={0} step="0.01" placeholder="0.00" {...register('amount')} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-category">Category (optional)</Label>
              <Input
                id="expense-category"
                placeholder="e.g. Registration"
                list="expense-category-options"
                {...register('category')}
              />
              <datalist id="expense-category-options">
                <option value="Registration" />
                <option value="Insurance" />
                <option value="Repair" />
                <option value="Commission" />
                <option value="Transport" />
                <option value="Other" />
              </datalist>
              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
