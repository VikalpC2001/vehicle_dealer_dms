import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Download, Upload, Trash2, Eye, Loader2, Truck, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DocumentPreviewDialog } from '@/components/vehicle-process/DocumentPreviewDialog'
import { uploadService } from '@/services/uploadService'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { DOCUMENT_MIME_TYPES, toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'
import { downloadFileFromUrl } from '@/lib/zip'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDateTime } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

/**
 * RTO receipt (PDF/image) + RC-book tracking number for a vehicle process. The agent working the
 * process uploads/edits both (`canEdit`); the dealer sees a read-only view and can download the
 * receipt. Self-contained mutations; the parent passes the query key(s) to invalidate on change.
 *
 * @param {object} props
 * @param {string} props.processId
 * @param {{imageName:string, photoUrl:string, uploadedAt?:string}|null} [props.receipt]
 * @param {string|null} [props.trackingNumber]
 * @param {boolean} [props.canEdit] - true on the agent surfaces, false for the dealer.
 * @param {Array<Array>} [props.invalidateKeys] - query keys to invalidate after a change.
 */
export function RtoReceiptPanel({ processId, receipt, trackingNumber, canEdit = false, invalidateKeys = [] }) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [tracking, setTracking] = useState(trackingNumber ?? '')
  const fileRef = useRef(null)

  const invalidate = () => invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))

  const setReceiptMutation = useMutation({
    mutationFn: (imageName) => vehicleProcessService.setReceipt(processId, imageName),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Receipt uploaded', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not upload receipt', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const clearReceiptMutation = useMutation({
    mutationFn: () => vehicleProcessService.clearReceipt(processId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Receipt removed', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not remove receipt', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const setTrackingMutation = useMutation({
    mutationFn: (value) => vehicleProcessService.setTrackingNumber(processId, value),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Tracking number saved', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not save tracking number', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setUploading(true)
    try {
      const { fileKey } = await uploadService.uploadImage(file)
      // Fire-and-forget: the mutation's own onError reports a PATCH failure, so this catch only
      // handles the upload step — avoids a double toast when the save (not the upload) fails.
      setReceiptMutation.mutate(fileKey)
    } catch (err) {
      toast({ title: 'Upload failed', description: getErrorMessage(err) || err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async () => {
    if (!receipt) return
    setDownloading(true)
    try {
      const ext = isPdfUrl(receipt.photoUrl) ? 'pdf' : receipt.photoUrl.split('.').pop() || 'jpg'
      await downloadFileFromUrl(receipt.photoUrl, `RTO-Receipt.${ext}`)
    } catch (err) {
      toast({ title: 'Download failed', description: getErrorMessage(err) || err.message, variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  const isPdf = receipt && isPdfUrl(receipt.photoUrl)
  // One busy flag across upload + set + clear so Replace and Remove disable each other (no clear+set race).
  const busy = uploading || setReceiptMutation.isPending || clearReceiptMutation.isPending
  const trackingDirty = (tracking ?? '').trim() !== (trackingNumber ?? '')

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">RTO Receipt &amp; RC Book</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">RTO Receipt (PDF or image)</p>
          {receipt ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <button type="button" onClick={() => setPreview(true)} aria-label="Preview receipt" className="shrink-0">
                {isPdf ? (
                  <div className="flex h-14 w-14 flex-col items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                    <FileText className="h-6 w-6" />
                    <span className="text-[9px] font-medium">PDF</span>
                  </div>
                ) : (
                  <img
                    src={toAppImageUrl(receipt.photoUrl)}
                    alt="Receipt"
                    className="h-14 w-14 rounded-md border border-border object-cover"
                  />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Receipt attached</p>
                {receipt.uploadedAt && (
                  <p className="text-xs text-muted-foreground">Uploaded {formatDateTime(receipt.uploadedAt)}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
                  <Eye className="mr-1.5 h-4 w-4" /> View
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
                  {downloading ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-4 w-4" />
                  )}
                  Download
                </Button>
                {canEdit && (
                  <>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                      {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove receipt"
                      disabled={busy}
                      onClick={() => clearReceiptMutation.mutate()}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : canEdit ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="mr-1.5 h-4 w-4" /> Upload receipt</>
              )}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">No receipt uploaded yet.</p>
          )}
          {canEdit && (
            <input
              ref={fileRef}
              type="file"
              accept={DOCUMENT_MIME_TYPES.join(',')}
              className="hidden"
              onChange={handleFile}
            />
          )}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Truck className="h-3.5 w-3.5" /> RC Book Tracking Number
          </p>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Post / courier tracking no. (optional)"
                className="max-w-xs"
                maxLength={255}
              />
              <Button
                size="sm"
                onClick={() => setTrackingMutation.mutate(tracking)}
                disabled={setTrackingMutation.isPending || !trackingDirty}
              >
                {setTrackingMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          ) : trackingNumber ? (
            <p className="text-sm font-medium">{trackingNumber}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not dispatched yet.</p>
          )}
        </div>
      </CardContent>

      <DocumentPreviewDialog open={preview} onOpenChange={setPreview} url={receipt?.photoUrl} label="RTO Receipt" />
    </Card>
  )
}
