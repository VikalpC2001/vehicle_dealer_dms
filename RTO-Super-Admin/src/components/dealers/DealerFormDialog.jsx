import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { DealerForm } from '@/components/forms/DealerForm'

export function DealerFormDialog({ open, onOpenChange, title, description, defaultValues, onSubmit, loading, submitLabel }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DealerForm
          defaultValues={defaultValues}
          onSubmit={onSubmit}
          loading={loading}
          submitLabel={submitLabel}
        />
      </DialogContent>
    </Dialog>
  )
}
