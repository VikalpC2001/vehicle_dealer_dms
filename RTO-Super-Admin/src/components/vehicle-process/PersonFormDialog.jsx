import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseValidationErrors, getErrorMessage } from '@/lib/authErrors'
import { ImageCropperDialog } from './ImageCropperDialog'
import { uploadService, validateImageFile } from '@/services/uploadService'
import { aiService, getAiErrorMessage } from '@/services/aiService'
import { DOCUMENT_MIME_TYPES, isPdfFile, mapIdProofToPerson } from '@/lib/vehicleProcess'
import { toast } from '@/hooks/use-toast'

export const personSchema = z.object({
  personName: z.string().min(1, 'Name is required').max(255),
  mobileNumber: z.string().min(1, 'Mobile number is required').max(20),
  address: z.string().optional().or(z.literal('')),
  personType: z.enum(['SELLER', 'BUYER']),
})

export const defaultPersonValues = {
  personName: '',
  mobileNumber: '',
  address: '',
  personType: 'BUYER',
}

/**
 * Add/edit a buyer or seller, with an OPTIONAL ID-proof document. A single "Upload ID" action does
 * both jobs: an image is cropped → run through ID OCR to auto-fill name & address → and stored as the
 * person's ID; a PDF is stored as-is (no OCR). The stored key is submitted as `idImageName`, which the
 * server links to the person so it appears in the Documents grid (for the active person).
 *
 * Submits `{ personName, mobileNumber, address, personType, idImageName? }`. The parent remounts this
 * per open (a changing `key`, see PersonsPanel) so an upload never leaks between opens.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {object} [props.defaultValues]
 * @param {boolean} [props.lockType] - Disable the SELLER/BUYER switch (e.g. "Add buyer").
 * @param {(values: object) => Promise<void>} props.onSubmit
 * @param {boolean} [props.loading]
 * @param {string} [props.submitLabel]
 */
export function PersonFormDialog({
  open,
  onOpenChange,
  title,
  defaultValues,
  lockType = false,
  onSubmit,
  loading,
  submitLabel = 'Save',
}) {
  // The parent remounts this dialog per open (key={personNonce} in PersonsPanel), so useForm's
  // defaultValues initialize fresh each time — no reset-on-open effect (which, keyed on the inline
  // defaultValues object, would also re-fire on any parent re-render and wipe OCR-autofilled fields).
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(personSchema),
    defaultValues: { ...defaultPersonValues, ...defaultValues },
  })

  const personType = watch('personType')
  const idLabel = personType === 'SELLER' ? 'Seller' : 'Buyer'

  // ID-proof upload (kept fresh per open via the parent's remount key).
  const [idImageName, setIdImageName] = useState('')
  const [idFileName, setIdFileName] = useState('')
  const [busy, setBusy] = useState(false) // OCR/upload in progress
  const [cropFile, setCropFile] = useState(null)
  const fileRef = useRef(null)

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

  // Store a file as the person's ID (final image, or a PDF).
  const storeId = async (file, name) => {
    setBusy(true)
    try {
      const { fileKey } = await uploadService.uploadImage(file)
      setIdImageName(fileKey)
      setIdFileName(name)
    } catch (err) {
      toast({ title: 'ID upload failed', description: getErrorMessage(err) || err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  // After cropping an image: run ID OCR (best-effort auto-fill) AND store it as the person's ID.
  const handleCropped = async (cropped) => {
    setCropFile(null)
    setBusy(true)
    try {
      try {
        const data = await aiService.analyzeIdProof(cropped)
        const fields = mapIdProofToPerson(data)
        if (fields.name) setValue('personName', fields.name, { shouldDirty: true })
        if (fields.address) setValue('address', fields.address, { shouldDirty: true })
        toast({ title: 'Details captured from ID', variant: 'success' })
      } catch (err) {
        // OCR is best-effort — keep the file even if reading fails.
        toast({ title: 'Could not read ID', description: getAiErrorMessage(err) })
      }
      const { fileKey } = await uploadService.uploadImage(cropped)
      setIdImageName(fileKey)
      setIdFileName('id-proof.jpg')
    } catch (err) {
      toast({ title: 'ID upload failed', description: getErrorMessage(err) || err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const removeId = () => {
    setIdImageName('')
    setIdFileName('')
  }

  const handleFormSubmit = async (values) => {
    try {
      await onSubmit({
        ...values,
        address: values.address?.trim() || null,
        idImageName: idImageName || undefined,
      })
    } catch (err) {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Buyer and seller details for this process.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{idLabel} ID (optional — auto-fills from an image)</Label>
              {idImageName ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{idFileName || 'ID uploaded'}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                      Replace
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove ID" disabled={busy} onClick={removeId}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Processing…</>
                  ) : (
                    <><ScanLine className="mr-1.5 h-4 w-4" /> Upload {idLabel} ID (PDF/image)</>
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
                Image IDs are auto-read to fill name &amp; address and stored as this person&apos;s ID; PDFs are stored as-is.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="personType">Type</Label>
              <Select value={personType} onValueChange={(v) => setValue('personType', v)} disabled={lockType}>
                <SelectTrigger id="personType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELLER">Seller</SelectItem>
                  <SelectItem value="BUYER">Buyer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="personName">Name</Label>
              <Input id="personName" placeholder="Full name" {...register('personName')} />
              {errors.personName && <p className="text-sm text-destructive">{errors.personName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Mobile Number</Label>
              <Input id="mobileNumber" placeholder="9876543210" {...register('mobileNumber')} />
              {errors.mobileNumber && <p className="text-sm text-destructive">{errors.mobileNumber.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" placeholder="Address (optional)" {...register('address')} />
            </div>

            <Button type="submit" className="w-full" disabled={loading || busy}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : submitLabel}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ImageCropperDialog
        open={Boolean(cropFile)}
        file={cropFile}
        fileName="id-proof.jpg"
        onCancel={() => setCropFile(null)}
        onCropped={handleCropped}
      />
    </>
  )
}
