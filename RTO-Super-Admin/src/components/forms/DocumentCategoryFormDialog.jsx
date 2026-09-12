import { useMemo } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { parseValidationErrors, getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

const schema = z.object({
  categoryName: z.string().min(1, 'Category name is required').max(255),
  processApi: z.string().max(512).optional(),
  bothSide: z.boolean(),
})

/**
 * Create/edit a master document category (`UploadCategory`) — name, the OCR **Extraction API**
 * (super-admin-managed; inherited by dealers/agents), and whether it captures both sides.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {object} [props.defaultValues]
 * @param {(values: object) => Promise<void>} props.onSubmit
 * @param {boolean} [props.loading]
 * @param {string} [props.submitLabel]
 */
export function DocumentCategoryFormDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultValues,
  onSubmit,
  loading,
  submitLabel = 'Save',
}) {
  const values = useMemo(
    () => ({
      categoryName: defaultValues?.categoryName ?? '',
      processApi: defaultValues?.processApi ?? '',
      bothSide: Boolean(defaultValues?.bothSide),
    }),
    [defaultValues],
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), values })

  const bothSide = watch('bothSide')

  const submit = async (v) => {
    try {
      await onSubmit({
        categoryName: v.categoryName.trim(),
        bothSide: v.bothSide,
        processApi: v.processApi?.trim() || null,
      })
    } catch (err) {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
      toast({ title: 'Could not save', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="categoryName">Category Name</Label>
            <Input id="categoryName" placeholder="e.g. Buyer ID" {...register('categoryName')} />
            {errors.categoryName && <p className="text-sm text-destructive">{errors.categoryName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="processApi">Extraction API (optional)</Label>
            <Input id="processApi" placeholder="e.g. ai/analyze-id-proof" {...register('processApi')} />
            {errors.processApi && <p className="text-sm text-destructive">{errors.processApi.message}</p>}
            <p className="text-xs text-muted-foreground">
              OCR endpoint used to auto-fill details from an uploaded image of this document. Applies to all
              dealers &amp; agents. Full URL or a path appended to the API base.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Capture both sides</p>
              <p className="text-xs text-muted-foreground">Front &amp; back (e.g. an ID card).</p>
            </div>
            <Switch checked={bothSide} onCheckedChange={(v) => setValue('bothSide', v)} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
