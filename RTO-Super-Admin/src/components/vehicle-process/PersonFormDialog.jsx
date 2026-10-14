import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, ScanLine, FileText, X, Check } from 'lucide-react'
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
import { IdScanOverlay } from './IdScanOverlay'
import { uploadService, validateImageFile } from '@/services/uploadService'
import { aiService } from '@/services/aiService'
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
 * @param {boolean} [props.successView] - after a successful submit, crossfade to a success animation
 *   inside this SAME dialog (no resize) instead of letting the parent close it.
 * @param {string} [props.successTitle]
 * @param {string} [props.successDescription]
 * @param {() => void} [props.onDone] - called when the success "Done" button is clicked.
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
  successView = false,
  successTitle,
  successDescription,
  onDone,
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
  const [scanState, setScanState] = useState(null) // 'scanning' | 'failed' → ID-scan overlay
  const [cropFile, setCropFile] = useState(null)
  const fileRef = useRef(null)
  // Set when the user bails to manual entry mid-scan, so a late OCR result doesn't clobber their
  // typing or re-show the overlay.
  const scanDismissedRef = useRef(false)

  const dismissScan = () => {
    scanDismissedRef.current = true
    setScanState(null)
  }

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
    scanDismissedRef.current = false
    setScanState('scanning') // show the ID-scan animation while OCR runs
    try {
      try {
        const data = await aiService.analyzeIdProof(cropped)
        const fields = mapIdProofToPerson(data)
        if (scanDismissedRef.current) {
          // User already bailed to manual entry — don't overwrite what they're typing.
        } else if (fields.name || fields.address) {
          if (fields.name) setValue('personName', fields.name, { shouldDirty: true })
          if (fields.address) setValue('address', fields.address, { shouldDirty: true })
          setScanState(null) // got something → hide the animation and let the user review/continue
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
      setIdImageName(fileKey)
      setIdFileName('id-proof.webp')
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

  // When successView is on, a resolved submit swaps the body to a success animation (same dialog).
  const [submitted, setSubmitted] = useState(false)

  const handleFormSubmit = async (values) => {
    try {
      await onSubmit({
        ...values,
        address: values.address?.trim() || null,
        idImageName: idImageName || undefined,
      })
      if (successView) setSubmitted(true)
    } catch (err) {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
    }
  }

  const showSuccess = successView && submitted

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showSuccess ? successTitle || 'Success' : title}</DialogTitle>
            <DialogDescription>
              {showSuccess
                ? successDescription || 'Done.'
                : 'Buyer and seller details for this process.'}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="space-y-4"
            aria-hidden={showSuccess || undefined}
            style={showSuccess ? { pointerEvents: 'none' } : undefined}
          >
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

          {/* ID-scan animation while an uploaded ID is OCR-read; offers manual entry on failure. */}
          <IdScanOverlay status={scanState} onManual={dismissScan} />

          {/* Success animation — overlays the (still-mounted) form so the dialog keeps its size. */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-md bg-card text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <motion.span
                    className="absolute inset-0 rounded-full bg-success/20"
                    initial={{ scale: 0.4, opacity: 0.7 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.4 }}
                  />
                  <motion.div
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success"
                    initial={{ scale: 0, rotate: -25 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.14, type: 'spring', stiffness: 320, damping: 14 }}
                    >
                      <Check className="h-8 w-8" strokeWidth={3} />
                    </motion.span>
                  </motion.div>
                </div>
                <Button className="w-full" onClick={() => (onDone ? onDone() : onOpenChange(false))}>
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      <ImageCropperDialog
        open={Boolean(cropFile)}
        file={cropFile}
        fileName="id-proof.webp"
        onCancel={() => setCropFile(null)}
        onCropped={handleCropped}
      />
    </>
  )
}
