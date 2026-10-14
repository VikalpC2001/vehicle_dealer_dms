import { CirclePause } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ACCESS_PAUSED_MESSAGE } from '@/lib/accessPaused'

/**
 * Blocking "Access paused" popup shown after a forced sign-out (the super admin paused the user's
 * firm). The confirm button is the ONLY way out: no corner close icon, and clicking outside or
 * pressing Escape does nothing. On confirm the caller sends the user to the login page.
 *
 * The page it interrupts stays mounted behind it, so it is layered above everything that page may
 * have open (other dialogs at z-50, the full-screen document viewer at z-60) and keeps its pointer
 * events even if another dialog mounts after it — OK must always be visible and clickable.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} [props.message] - Defaults to the standard contact-the-super-admin message.
 * @param {string} [props.confirmLabel='OK']
 * @param {() => void} props.onConfirm
 */
export function AccessPausedDialog({ open, message, confirmLabel = 'OK', onConfirm }) {
  return (
    <Dialog open={open}>
      <DialogContent
        role="alertdialog"
        className="z-[70] max-w-md"
        overlayClassName="z-[70]"
        style={{ pointerEvents: 'auto' }}
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader className="items-center sm:text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
            <CirclePause className="h-7 w-7 text-warning" aria-hidden="true" />
          </div>
          <DialogTitle>Access paused</DialogTitle>
          <DialogDescription>{message || ACCESS_PAUSED_MESSAGE}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
