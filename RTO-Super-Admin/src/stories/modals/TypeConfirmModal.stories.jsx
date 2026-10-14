import { useState } from 'react'
import { TypeConfirmModal } from '@/components/modals/TypeConfirmModal'
import { Button } from '@/components/ui/button'

const meta = { title: 'Modals/TypeConfirmModal', tags: ['autodocs'] }
export default meta

export const Destructive = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal</Button>
        <TypeConfirmModal
          open={open}
          onOpenChange={setOpen}
          title="Delete process"
          description="This moves the process to the Bin. It can be restored for 7 days, after which it is permanently purged."
          confirmWord="DELETE"
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => setOpen(false)}
        />
      </>
    )
  },
}

export const CustomWord = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <TypeConfirmModal
        open={open}
        onOpenChange={setOpen}
        title="Delete forever"
        description="This permanently deletes MH12AB1234 and all its data. This cannot be undone."
        confirmWord="MH12AB1234"
        confirmLabel="Delete forever"
        variant="destructive"
        onConfirm={() => setOpen(false)}
      />
    )
  },
}
