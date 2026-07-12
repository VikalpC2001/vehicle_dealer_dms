import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

const meta = { title: 'UI/Toast', tags: ['autodocs'] }
export default meta

export const Success = {
  render: () => (
    <>
      <Button onClick={() => toast({ title: 'Success', description: 'Changes saved.', variant: 'success' })}>
        Show Success Toast
      </Button>
      <Toaster />
    </>
  ),
}

export const Destructive = {
  render: () => (
    <>
      <Button variant="destructive" onClick={() => toast({ title: 'Error', description: 'Login failed.', variant: 'destructive' })}>
        Show Error Toast
      </Button>
      <Toaster />
    </>
  ),
}

export const StaticPreview = {
  render: () => (
    <ToastProvider>
      <Toast variant="success" open>
        <div className="grid gap-1">
          <ToastTitle>Welcome back!</ToastTitle>
          <ToastDescription>You have successfully logged in.</ToastDescription>
        </div>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  ),
}
