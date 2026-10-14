import { useState } from 'react'
import { AccessPausedDialog } from '@/components/modals/AccessPausedDialog'
import { Button } from '@/components/ui/button'

const meta = { title: 'Modals/AccessPausedDialog', tags: ['autodocs'] }
export default meta

export const Default = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal</Button>
        <AccessPausedDialog open={open} onConfirm={() => setOpen(false)} />
      </>
    )
  },
}

export const CustomMessage = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <AccessPausedDialog
        open={open}
        message="Access for Shree Motors has been paused. Please contact the super admin to restore it."
        confirmLabel="Go to login"
        onConfirm={() => setOpen(false)}
      />
    )
  },
}
