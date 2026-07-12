import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/**
 * Step 3 — read-only review of everything before the single create call.
 *
 * @param {object} props
 * @param {object} props.values - Verify-form values.
 * @param {Record<string, object>} props.slots - Upload slots (uploaded ones are shown).
 * @param {Array<{referenceId,referenceName,referenceNumber}>} props.references
 */
export function StepReviewSubmit({ values, slots, references = [] }) {
  const uploaded = Object.values(slots).filter((s) => s.status === 'uploaded')
  const reference = references.find((r) => r.referenceId === values.sellerReferenceId)

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

      {values.addBuyer && (values.buyerName || values.buyerMobile || values.buyerAddress) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buyer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {values.buyerName && <p className="font-medium">{values.buyerName}</p>}
            {values.buyerMobile && <p className="text-muted-foreground">{values.buyerMobile}</p>}
            {values.buyerAddress && <p className="text-muted-foreground">{values.buyerAddress}</p>}
          </CardContent>
        </Card>
      )}

      {reference && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Reference:</span>
          <Badge variant="secondary">
            {reference.referenceName} ({reference.referenceNumber})
          </Badge>
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
              {uploaded.map((slot) => (
                <figure key={slot.category} className="space-y-1">
                  <img
                    src={slot.previewUrl || slot.publicUrl}
                    alt={slot.category}
                    className="h-24 w-full rounded-md border border-border object-cover"
                  />
                  <figcaption className="truncate text-xs text-muted-foreground">{slot.category}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
