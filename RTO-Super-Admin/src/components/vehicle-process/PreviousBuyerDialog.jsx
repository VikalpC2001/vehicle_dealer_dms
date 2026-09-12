import { User, FileText } from 'lucide-react'
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
 * Read-only modal showing a previous (cancelled) buyer's details plus their ID document(s). These
 * docs are intentionally kept out of the process's main documents grid — this modal is where they're
 * viewed. Clicking a document calls `onPreview` to open the full-size preview.
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" /> Previous Buyer
          </DialogTitle>
          <DialogDescription>This buyer was replaced and is kept for history.</DialogDescription>
        </DialogHeader>

        {buyer && (
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{buyer.personName}</p>
                <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                  Cancelled
                </Badge>
              </div>
              {buyer.mobileNumber && <p className="text-muted-foreground">{buyer.mobileNumber}</p>}
              {buyer.address && <p className="text-muted-foreground">{buyer.address}</p>}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">ID documents</p>
              {photos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <button
                      key={p.processUploadPhotoId}
                      type="button"
                      onClick={() => onPreview({ url: p.photoUrl, label: p.category })}
                      className="block shrink-0"
                      aria-label={`Preview ${p.category}`}
                    >
                      {isPdfUrl(p.photoUrl) ? (
                        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                          <FileText className="h-5 w-5" />
                          <span className="text-[8px] font-medium">PDF</span>
                        </div>
                      ) : (
                        <img
                          src={toAppImageUrl(p.photoUrl)}
                          alt={p.category}
                          className="h-16 w-16 rounded-md border border-border object-cover"
                        />
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
