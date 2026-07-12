import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CityForm } from '@/components/forms/CityForm'

export function CityFormDialog({
  open, onOpenChange, title, description, defaultValues, states, onSubmit, loading, submitLabel, lockState,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <CityForm
          defaultValues={defaultValues}
          states={states}
          onSubmit={onSubmit}
          loading={loading}
          submitLabel={submitLabel}
          lockState={lockState}
        />
      </DialogContent>
    </Dialog>
  )
}
