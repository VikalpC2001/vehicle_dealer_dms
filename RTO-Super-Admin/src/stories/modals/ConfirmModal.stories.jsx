import { useState } from 'react'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { Button } from '@/components/ui/button'

const meta = { title: 'Modals/ConfirmModal', tags: ['autodocs'] }
export default meta

export const Approve = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal</Button>
        <ConfirmModal
          open={open}
          onOpenChange={setOpen}
          title="Approve User"
          description="Are you sure you want to approve Amit Patel? This action will be logged."
          confirmLabel="Approve"
          onConfirm={() => setOpen(false)}
        />
      </>
    )
  },
}

export const Destructive = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <ConfirmModal
        open={open}
        onOpenChange={setOpen}
        title="Delete User"
        description="Are you sure you want to delete this user? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => setOpen(false)}
      />
    )
  },
}
