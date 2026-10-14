import { User, FileText, Maximize2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'

/**
 * Read-only modal showing a previous (cancelled) buyer's details alongside their ID document(s).
 * These docs are intentionally kept out of the process's main documents grid — this modal is where
 * they're viewed. Laid out two-up on wider screens: the buyer's details on the LEFT and the ID proof
 * shown inline (visible, not a thumbnail) on the RIGHT; clicking an ID opens the full-size preview.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object|null} props.buyer - { personName, mobileNumber, address, status, idPhotos[] }
 * @param {(doc: { url: string, label: string }) => void} props.onPreview
 */
export function PreviousBuyerDialog({ open, onOpenChange, buyer, onPreview }) {
  const photos = buyer?.idPhotos ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" /> Previous Buyer
          </DialogTitle>
          <DialogDescription>This buyer was replaced and is kept for history.</DialogDescription>
        </DialogHeader>

        {buyer && (
          <div className="grid gap-6 text-sm sm:grid-cols-2">
            {/* Left — buyer details */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Buyer details</p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{buyer.personName}</p>
                <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                  Cancelled
                </Badge>
              </div>
              {buyer.mobileNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  <p>{buyer.mobileNumber}</p>
                </div>
              )}
              {buyer.address && (
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="whitespace-pre-line">{buyer.address}</p>
                </div>
              )}
            </div>

            {/* Right — ID proof, shown inline (click to enlarge) */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">ID proof</p>
              {photos.length > 0 ? (
                <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
                  {photos.map((p) => (
                    <button
                      key={p.processUploadPhotoId}
                      type="button"
                      onClick={() => onPreview({ url: p.photoUrl, label: p.category })}
                      className="group relative block w-full overflow-hidden rounded-lg border border-border bg-muted/30"
                      aria-label={`Preview ${p.category}`}
                    >
                      {isPdfUrl(p.photoUrl) ? (
                        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                          <FileText className="h-7 w-7" />
                          <span className="text-xs font-medium">Open PDF</span>
                        </div>
                      ) : (
                        <>
                          <img
                            src={toAppImageUrl(p.photoUrl)}
                            alt={p.category}
                            className="max-h-72 w-full object-contain"
                          />
                          <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                            <Maximize2 className="h-3 w-3" /> Enlarge
                          </span>
                        </>
                      )}
                      {p.category && (
                        <span className="block border-t border-border px-2 py-1 text-left text-[11px] text-muted-foreground">
                          {p.category}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No documents were uploaded for this buyer.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
