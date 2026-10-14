import { MessageCircle, Mail } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Custom share menu for a stored document — WhatsApp or email only. Shares a LINK to the file (the
 * `/uploads` files are public-read; a URL scheme can't attach a file), which works for the recipient
 * once the app is served publicly. Used for ALL share clicks (desktop + mobile) instead of the native
 * share sheet, so the options are consistent everywhere.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {{ photoUrl?: string, category?: string } | null} [props.photo]
 */
export function ShareDialog({ open, onOpenChange, photo }) {
  const url = photo?.photoUrl || ''
  const title = photo?.category || 'Document'
  const close = () => onOpenChange(false)

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${title}\n${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
    close()
  }

  const shareEmail = () => {
    const subject = encodeURIComponent(title)
    const body = encodeURIComponent(`${title}\n${url}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
    close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button variant="outline" className="justify-start" onClick={shareWhatsApp}>
            <MessageCircle className="mr-2 h-4 w-4 text-success" /> WhatsApp
          </Button>
          <Button variant="outline" className="justify-start" onClick={shareEmail}>
            <Mail className="mr-2 h-4 w-4 text-primary" /> Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
