import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts, dismiss } = useToast()
  // A toast that is sliding out is still the top Escape layer until it unmounts. It passes the key on
  // to the newest toast that is still open, so an Escape pressed during the exit is not lost.
  const closeNewestOpen = () => {
    const next = toasts.find((t) => t.open)
    if (next) dismiss(next.id)
  }
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props} onEscapeKeyDown={props.open ? props.onEscapeKeyDown : closeNewestOpen}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
