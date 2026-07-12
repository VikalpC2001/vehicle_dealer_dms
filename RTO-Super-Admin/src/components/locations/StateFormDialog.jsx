import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { StateForm } from '@/components/forms/StateForm'

export function StateFormDialog({ open, onOpenChange, title, description, defaultValues, onSubmit, loading, submitLabel }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <StateForm
          defaultValues={defaultValues}
          onSubmit={onSubmit}
          loading={loading}
          submitLabel={submitLabel}
        />
      </DialogContent>
    </Dialog>
  )
}
