import { useRef, useState } from 'react'
import { Loader2, ScanLine, FileText, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImageCropperDialog } from './ImageCropperDialog'
import { IdScanOverlay } from './IdScanOverlay'
import { uploadService, validateImageFile } from '@/services/uploadService'
import { aiService } from '@/services/aiService'
import { DOCUMENT_MIME_TYPES, isPdfFile, mapIdProofToPerson } from '@/lib/vehicleProcess'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

const EMPTY = { personName: '', mobileNumber: '', address: '' }

/**
 * Collects a NEW buyer's details plus an optional ID-proof document, then calls `onSubmit` with
 * `{ personName, mobileNumber, address, buyerIdImageName }`. Used by the "Change Buyer" flow (the
 * current buyer is cancelled and this new buyer is added).
 *
 * A single "Upload Buyer ID" action does both jobs: for an image it crops → runs ID OCR to auto-fill
 * name & address → and stores that same image as the buyer's ID (`buyerIdImageName`); a PDF is stored
 * as-is (no OCR). Re-uploading replaces the stored ID. The server links the ID to the new buyer.
 *
 * The parent remounts this via a changing `key` on each open (see PersonsPanel), so state starts
 * fresh every time — no reset-on-open effect, and an upload abandoned in a prior open can't leak
 * into a later one (it resolves against the discarded instance).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {(values: object) => Promise<void>|void} props.onSubmit
 * @param {boolean} [props.loading]
 */
export function ChangeBuyerDialog({ open, onOpenChange, onSubmit, loading }) {
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false) // OCR/upload in progress
  const [scanState, setScanState] = useState(null) // 'scanning' | 'failed' → ID-scan overlay
  const [buyerIdImageName, setBuyerIdImageName] = useState('')
  const [idFileName, setIdFileName] = useState('')
  const [cropFile, setCropFile] = useState(null)
  const fileRef = useRef(null)
  // Set when the user bails to manual entry mid-scan, so a late OCR result doesn't clobber their
  // typing or re-show the overlay.
  const scanDismissedRef = useRef(false)

  const dismissScan = () => {
    scanDismissedRef.current = true
    setScanState(null)
  }

  const applyOcr = (fields) =>
    setForm((f) => ({
      ...f,
      personName: fields.name || f.personName,
      address: fields.address || f.address,
    }))

  const handleIdFile = (e) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    const check = validateImageFile(file)
    if (!check.ok) {
      toast({ title: 'Invalid file', description: check.error, variant: 'destructive' })
      return
    }
    if (isPdfFile(file)) {
      void storeId(file, file.name) // PDF: store as ID, no OCR
    } else {
      setCropFile(file) // image: crop → OCR + store
    }
  }

  // Store a file as the buyer's ID (final image, or a PDF).
  const storeId = async (file, name) => {
    setBusy(true)
    try {
      const { fileKey } = await uploadService.uploadImage(file)
      setBuyerIdImageName(fileKey)
      setIdFileName(name)
    } catch (err) {
      toast({ title: 'ID upload failed', description: getErrorMessage(err) || err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  // After cropping an image: run ID OCR (best-effort auto-fill) AND store it as the buyer's ID.
  const handleCropped = async (cropped) => {
    setCropFile(null)
    setBusy(true)
    scanDismissedRef.current = false
    setScanState('scanning') // show the ID-scan animation while OCR runs
    try {
      try {
        const data = await aiService.analyzeIdProof(cropped)
        const fields = mapIdProofToPerson(data)
        if (scanDismissedRef.current) {
          // User already bailed to manual entry — don't overwrite what they're typing.
        } else if (fields.name || fields.address) {
          applyOcr(fields)
          setScanState(null) // got something → hide the animation
          toast({ title: 'Details captured from ID', variant: 'success' })
        } else {
          // The backend returns 200 with all-null fields for an unreadable ID (not an error), so an
          // empty result means nothing was read → offer manual entry instead of a false "captured".
          setScanState('failed')
        }
      } catch {
        // OCR is best-effort — keep the file; the overlay offers manual entry.
        if (!scanDismissedRef.current) setScanState('failed')
      }
      const { fileKey } = await uploadService.uploadImage(cropped)
      setBuyerIdImageName(fileKey)
      setIdFileName('buyer-id.webp')
    } catch (err) {
      toast({ title: 'ID upload failed', description: getErrorMessage(err) || err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const removeId = () => {
    setBuyerIdImageName('')
    setIdFileName('')
  }

  const canSave = form.personName.trim() && form.mobileNumber.trim() && !busy

  const submit = (e) => {
    e.preventDefault()
    if (!canSave) return
    onSubmit({
      personName: form.personName.trim(),
      mobileNumber: form.mobileNumber.trim(),
      address: form.address.trim() || null,
      buyerIdImageName: buyerIdImageName || undefined,
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Buyer</DialogTitle>
            <DialogDescription>
              The current buyer will be cancelled (kept for history) and this new buyer added. Upload
              the new buyer&apos;s ID to auto-fill their name &amp; address.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Buyer ID (auto-fills from an image)</Label>
              {buyerIdImageName ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{idFileName || 'ID uploaded'}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove ID"
                      disabled={busy}
                      onClick={removeId}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Processing…</>
                  ) : (
                    <><ScanLine className="mr-1.5 h-4 w-4" /> Upload Buyer ID (PDF/image)</>
                  )}
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={DOCUMENT_MIME_TYPES.join(',')}
                className="hidden"
                onChange={handleIdFile}
              />
              <p className="text-xs text-muted-foreground">
                Image IDs are auto-read to fill name &amp; address; PDFs are stored as-is.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cb-name">Name</Label>
              <Input
                id="cb-name"
                placeholder="Full name"
                value={form.personName}
                onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb-mobile">Mobile Number</Label>
              <Input
                id="cb-mobile"
                placeholder="9876543210"
                value={form.mobileNumber}
                onChange={(e) => setForm((f) => ({ ...f, mobileNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb-address">Address</Label>
              <Textarea
                id="cb-address"
                placeholder="Address (optional)"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>

            <Button type="submit" className="w-full" disabled={!canSave || loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Changing…</> : 'Change Buyer'}
            </Button>
          </form>
          {/* ID-scan animation while an uploaded ID is OCR-read; offers manual entry on failure. */}
          <IdScanOverlay status={scanState} onManual={dismissScan} />
          </div>
        </DialogContent>
      </Dialog>

      <ImageCropperDialog
        open={Boolean(cropFile)}
        file={cropFile}
        fileName="buyer-id.webp"
        onCancel={() => setCropFile(null)}
        onCropped={handleCropped}
      />
    </>
  )
}
