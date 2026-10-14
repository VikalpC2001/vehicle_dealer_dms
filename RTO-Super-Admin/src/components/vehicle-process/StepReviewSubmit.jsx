import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PhotoGalleryDialog } from './PhotoGalleryDialog'
import { toAppImageUrl } from '@/lib/vehicleProcess'
import { formatCurrency } from '@/lib/utils'
import { PROCESS_STATUS_LABEL, PROCESS_STATUS_COLOUR } from '@/lib/processStatus'

/** Amber "Open" swatch — matches the Open card in StepStatus (there is no terminal colour for it). */
const OPEN_COLOUR = '#f59e0b'

/**
 * Step 6 — read-only review of everything before the single create call.
 *
 * @param {object} props
 * @param {object} props.values - Wizard form values.
 * @param {Record<string, object>} props.slots - Upload slots (uploaded ones are shown).
 * @param {Array<{referenceId,referenceName,referenceNumber}>} props.references
 */
export function StepReviewSubmit({ values, slots, references = [] }) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const uploaded = Object.values(slots).filter((s) => s.status === 'uploaded')
  const dealNumber = (values.dealNumber ?? '').trim()
  // Mapped to the same shape DocumentsPanel/PhotoGalleryDialog use, so the review preview matches the
  // vehicle-details Documents tab (image + PDF viewer with navigation, print, download).
  const photos = uploaded.map((slot) => ({
    photoUrl: slot.publicUrl,
    category: slot.category,
    imageName: slot.fileKey,
  }))
  const sellerRef = references.find((r) => r.referenceId === values.sellerReferenceId)
  const buyerRef = references.find((r) => r.referenceId === values.buyerReferenceId)
  // A non-empty price string is always a valid number (the step-4 schema enforces it), so show it.
  const purchasePrice = (values.purchasePrice ?? '').trim()
  const salePrice = (values.salePrice ?? '').trim()
  // The BUYER person is created only when addBuyer AND both name + mobile are present (see
  // assembleStartPayload), so gate the buyer card on the same condition to stay consistent.
  const hasBuyer = Boolean(values.addBuyer && values.buyerName?.trim() && values.buyerMobile?.trim())

  const vehicleRows = [
    ['Registration Number', values.registrationNumber],
    ['Registration Date', values.registrationDate],
    ['Make', values.make],
    ['Model', values.model],
    ['Chassis Number', values.chassisNumber],
    ['Engine Number', values.engineNumber],
    ['Vehicle Type', values.vehicleType],
    ['Mfg. Month / Year', [values.manufactureMonth, values.manufactureYear].filter(Boolean).join(' / ')],
  ].filter(([, value]) => value)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: values.status ? PROCESS_STATUS_COLOUR[values.status] : OPEN_COLOUR }}
            />
            {values.status ? PROCESS_STATUS_LABEL[values.status] ?? values.status : 'Open'}
          </span>
        </div>
        {dealNumber && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Deal Number:</span>
            <span className="font-medium">{dealNumber}</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehicle</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {vehicleRows.map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {(values.sellerName || values.sellerMobile || values.sellerAddress) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seller / Owner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {values.sellerName && <p className="font-medium">{values.sellerName}</p>}
            {values.sellerMobile && <p className="text-muted-foreground">{values.sellerMobile}</p>}
            {values.sellerAddress && <p className="text-muted-foreground">{values.sellerAddress}</p>}
          </CardContent>
        </Card>
      )}

      {hasBuyer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buyer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{values.buyerName}</p>
            <p className="text-muted-foreground">{values.buyerMobile}</p>
            {values.buyerAddress && <p className="text-muted-foreground">{values.buyerAddress}</p>}
          </CardContent>
        </Card>
      )}

      {(purchasePrice || salePrice) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {purchasePrice && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Purchase price:</span>
              <span className="font-medium">{formatCurrency(Number(purchasePrice))}</span>
            </div>
          )}
          {salePrice && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Sale price:</span>
              <span className="font-medium">{formatCurrency(Number(salePrice))}</span>
            </div>
          )}
        </div>
      )}

      {(sellerRef || buyerRef) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">References:</span>
          {sellerRef && (
            <Badge variant="secondary">
              Seller: {sellerRef.referenceName} ({sellerRef.referenceNumber})
            </Badge>
          )}
          {buyerRef && (
            <Badge variant="secondary">
              Buyer: {buyerRef.referenceName} ({buyerRef.referenceNumber})
            </Badge>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents ({uploaded.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {uploaded.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {uploaded.map((slot, i) => (
                <figure key={slot.category} className="space-y-1">
                  <div className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted/30">
                    {slot.isPdf ? (
                      <object
                        data={`${toAppImageUrl(slot.publicUrl)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        type="application/pdf"
                        aria-label={slot.category}
                        className="pointer-events-none h-full w-full bg-white"
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                          <FileText className="h-6 w-6" />
                          <span className="text-[11px] font-medium">PDF</span>
                        </div>
                      </object>
                    ) : (
                      <img
                        src={slot.previewUrl || slot.publicUrl}
                        alt={slot.category}
                        className="pointer-events-none h-full w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setGalleryIndex(i)
                        setGalleryOpen(true)
                      }}
                      className="absolute inset-0 cursor-pointer transition group-hover:bg-black/5"
                      aria-label={`Preview ${slot.category}`}
                    />
                  </div>
                  <figcaption className="truncate text-xs text-muted-foreground">{slot.category}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PhotoGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        photos={photos}
        index={galleryIndex}
        onIndexChange={setGalleryIndex}
      />
    </div>
  )
}
