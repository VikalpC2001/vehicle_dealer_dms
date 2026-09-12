import { ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'

/**
 * In-app preview for an uploaded document. Images render inline; PDFs render in an iframe.
 * The URL is rewritten to same-origin via `toAppImageUrl` so it loads through the dev proxy.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} [props.url] - raw document URL
 * @param {string} [props.label] - category / document name shown in the header
 */
export function DocumentPreviewDialog({ open, onOpenChange, url, label }) {
  const src = toAppImageUrl(url)
  const pdf = isPdfUrl(url)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-8">
          <DialogTitle className="text-base">{label || 'Document'}</DialogTitle>
          {src && (
            <Button asChild variant="outline" size="sm">
              <a href={src} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Open
              </a>
            </Button>
          )}
        </DialogHeader>
        {!src ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No document to preview.</p>
        ) : pdf ? (
          <iframe
            src={src}
            title={label || 'Document'}
            className="h-[75vh] w-full rounded-md border border-border"
          />
        ) : (
          <div className="flex max-h-[75vh] justify-center overflow-auto rounded-md bg-muted/30 p-2">
            <img src={src} alt={label || 'Document'} className="max-h-[72vh] w-auto max-w-full object-contain" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
