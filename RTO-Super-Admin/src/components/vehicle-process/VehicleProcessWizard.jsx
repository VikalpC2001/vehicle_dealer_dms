import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Stepper } from '@/components/ui/stepper'
import { toast } from '@/hooks/use-toast'
import { dealerWiseUploadCategoryService } from '@/services/dealerWiseUploadCategoryService'
import { agentWiseUploadCategoryService } from '@/services/agentWiseUploadCategoryService'
import { dealerReferenceService } from '@/services/dealerReferenceService'
import { uploadService, validateImageFile } from '@/services/uploadService'
import { aiService, getAiErrorMessage } from '@/services/aiService'
import { collageVertical, downscaleImage } from '@/lib/image'
import {
  assembleStartPayload,
  isRcCategory,
  isBuyerIdCategory,
  isPdfFile,
  mapRcOcrToForm,
  mapIdProofToPerson,
} from '@/lib/vehicleProcess'
import { vehicleProcessSchema, defaultVehicleProcessValues } from '@/lib/vehicleProcessForm'
import { StepUploadDocuments } from './StepUploadDocuments'
import { StepVerifyVehicle } from './StepVerifyVehicle'
import { StepPersons } from './StepPersons'
import { StepReferencesPrices } from './StepReferencesPrices'
import { StepStatus } from './StepStatus'
import { StepReviewSubmit } from './StepReviewSubmit'
import { ImageCropperDialog } from './ImageCropperDialog'
import { ScanDocumentDialog } from './ScanDocumentDialog'

const STEPS = [
  { label: 'Documents' },
  { label: 'Vehicle' },
  { label: 'Seller & Buyer' },
  { label: 'References & Price' },
  { label: 'Status' },
  { label: 'Review' },
]

// 0-based step indices.
const STEP_DOCUMENTS = 0
const STEP_VEHICLE = 1
const STEP_PERSONS = 2
const STEP_REFS_PRICE = 3
const STEP_STATUS = 4
const STEP_REVIEW = 5

// Fields validated with `trigger()` when leaving each step. Buyer fields are injected only when the
// buyer block is shown; step-4 fields are all optional so their trigger always passes.
const VEHICLE_FIELDS = [
  'registrationNumber',
  'registrationDate',
  'make',
  'model',
  'chassisNumber',
  'engineNumber',
  'vehicleType',
  'manufactureMonth',
  'manufactureYear',
]
const SELLER_FIELDS = ['sellerName', 'sellerMobile', 'sellerAddress']
const BUYER_FIELDS = ['buyerName', 'buyerMobile', 'buyerAddress']
const REFS_PRICE_FIELDS = ['purchasePrice', 'salePrice', 'sellerReferenceId', 'buyerReferenceId']
const STATUS_FIELDS = ['status', 'dealNumber']

/** Keeps only non-empty values from an OCR mapping. */
function nonEmpty(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null))
}

/**
 * Create-process wizard: upload documents (crop each; two-sided docs are combined into
 * one image) → OCR autofill → verify → submit. `onSubmit(payload)` returns a promise.
 *
 * @param {object} props
 * @param {(payload: object) => Promise<unknown>} props.onSubmit
 * @param {boolean} props.submitting
 * @param {() => void} props.onCancel
 * @param {'dealer'|'agent'} [props.categorySource] Which upload-category config feeds the document
 *   checklist — the dealer's own (default) or the calling agent's (agent-managed processes).
 */
export function VehicleProcessWizard({ onSubmit, submitting, onCancel, categorySource = 'dealer' }) {
  const [step, setStep] = useState(0)
  const [slots, setSlots] = useState({}) // keyed by categoryId
  const [modes, setModes] = useState({}) // categoryId -> 'single' | 'both' (bothSide categories only)
  const [cropper, setCropper] = useState(null) // { categoryId, side, file, fileName }
  const [ocrPrefill, setOcrPrefill] = useState({})
  const [ocrStatus, setOcrStatus] = useState('idle')
  const [scanGateOpen, setScanGateOpen] = useState(false) // "scanning…" popup when Next is hit mid-OCR

  // ONE react-hook-form spanning steps 2–5 (Vehicle → Seller & Buyer → References & Price → Status).
  const methods = useForm({
    resolver: zodResolver(vehicleProcessSchema),
    defaultValues: defaultVehicleProcessValues,
  })
  const { reset: resetForm } = methods

  const slotsRef = useRef(slots)
  useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  const uploadCategoryApi =
    categorySource === 'agent' ? agentWiseUploadCategoryService : dealerWiseUploadCategoryService
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: [
      categorySource === 'agent' ? 'agent-wise-upload-categories' : 'dealer-wise-upload-categories',
      'view-in-step',
    ],
    queryFn: () => uploadCategoryApi.getViewInStep(),
  })
  const { data: references = [] } = useQuery({
    queryKey: ['dealer-references', 'ddl'],
    queryFn: () => dealerReferenceService.getDdl(),
    // Agent mode has no dealer-scoped references (the endpoint would 403); the steps handle [].
    enabled: categorySource !== 'agent',
  })

  const categoryById = useMemo(() => {
    const map = {}
    categories.forEach((c) => {
      map[c.categoryId] = c
    })
    return map
  }, [categories])

  // True only when a Buyer-ID document has actually been UPLOADED in step 1 — not merely when the
  // checklist configures a buyer-ID category. Used to tailor the step-3 helper text and to keep
  // addBuyer set for a buyer whose ID is already captured.
  const buyerIdUploaded = useMemo(
    () => categories.some((c) => isBuyerIdCategory(c) && slots[c.categoryId]?.status === 'uploaded'),
    [categories, slots]
  )

  // Seed the form from OCR without clobbering user edits — RC autofill fills empty vehicle/seller/
  // buyer fields before the user reaches step 2; fields the user already touched are kept.
  useEffect(() => {
    resetForm({ ...defaultVehicleProcessValues, ...ocrPrefill }, { keepDirtyValues: true })
  }, [ocrPrefill, resetForm])

  // Fields validated when leaving each step. The buyer block is always shown now (a buyer can be
  // added in step 3 even without a step-1 ID), so buyer fields are always validated — they're optional
  // unless partially filled (the schema's superRefine requires name + mobile together).
  const fieldsForStep = useMemo(
    () => ({
      [STEP_VEHICLE]: VEHICLE_FIELDS,
      [STEP_PERSONS]: [...SELLER_FIELDS, ...BUYER_FIELDS],
      [STEP_REFS_PRICE]: REFS_PRICE_FIELDS,
      [STEP_STATUS]: STATUS_FIELDS,
    }),
    []
  )

  // Revoke all object URLs on unmount.
  useEffect(() => {
    return () => {
      Object.values(slotsRef.current).forEach((slot) => {
        ;['front', 'back', 'single'].forEach((s) => slot?.[s]?.url && URL.revokeObjectURL(slot[s].url))
        if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl)
      })
    }
  }, [])

  useEffect(() => {
    const hasProgress = Object.keys(slots).length > 0 || step > 0
    if (!hasProgress) return undefined
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [slots, step])

  const updateSlot = (categoryId, patch) =>
    setSlots((prev) => ({ ...prev, [categoryId]: { ...prev[categoryId], ...patch } }))

  const runOcr = (category, file) => {
    if (isRcCategory(category)) {
      // Use the category's processApi when configured; otherwise the built-in RC reader.
      setOcrStatus('running')
      // Built-in RC reader → downscale → /ai/analyze-image (backend sends the image to Gemini vision).
      // Downscaling cuts image tokens (cost); vision reads the glyph directly for accuracy.
      const extract = category.processApi
        ? aiService.extractViaProcessApi(category.processApi, file)
        : downscaleImage(file, 2000).then((small) => aiService.analyzeImage(small))
      extract
        .then((data) => {
          setOcrPrefill((prev) => ({ ...prev, ...nonEmpty(mapRcOcrToForm(data)) }))
          setOcrStatus('done')
        })
        .catch((err) => {
          setOcrStatus('failed')
          toast({ title: 'Auto-fill unavailable', description: getAiErrorMessage(err) })
        })
    } else if (isBuyerIdCategory(category)) {
      // Buyer ID captured in Step 1: enable the buyer, and extract via the category's
      // processApi when configured (null processApi = manual entry only).
      setOcrPrefill((prev) => ({ ...prev, addBuyer: true }))
      if (category.processApi) {
        setOcrStatus('running')
        aiService
          .extractViaProcessApi(category.processApi, file)
          .then((data) => {
            const mapped = mapIdProofToPerson(data)
            setOcrPrefill((prev) => ({
              ...prev,
              addBuyer: true,
              buyerName: prev.buyerName || mapped.name || '',
              buyerAddress: prev.buyerAddress || mapped.address || '',
            }))
            setOcrStatus('done')
          })
          .catch((err) => {
            setOcrStatus('failed')
            toast({ title: 'Auto-fill unavailable', description: getAiErrorMessage(err) })
          })
      }
    }
    // NOTE: the seller (= vehicle owner) is sourced ONLY from the RC book (isRcCategory above).
    // An "Owner ID" upload is stored as a document but never used to auto-fill the seller.
  }

  const uploadSingle = (categoryId, file, previewUrl) => {
    updateSlot(categoryId, { status: 'uploading', error: null })
    uploadService
      .uploadImage(file)
      .then(({ fileKey, publicUrl }) => updateSlot(categoryId, { status: 'uploaded', fileKey, publicUrl, previewUrl, error: null }))
      .catch((err) => updateSlot(categoryId, { status: 'error', error: err?.message || 'Upload failed' }))
  }

  const uploadCombined = (category, frontFile, backFile) => {
    const categoryId = category.categoryId
    updateSlot(categoryId, { status: 'uploading', error: null })
    collageVertical(frontFile, backFile, `${category.categoryName}.webp`)
      .then((collageFile) => {
        if (!collageFile) throw new Error('Could not process the document image.')
        const previewUrl = URL.createObjectURL(collageFile)
        const prevPreview = slotsRef.current[categoryId]?.previewUrl
        if (prevPreview) URL.revokeObjectURL(prevPreview)
        // Analyse the COMBINED image so OCR reads both the front and back.
        runOcr(category, collageFile)
        return uploadService
          .uploadImage(collageFile)
          .then(({ fileKey, publicUrl }) =>
            updateSlot(categoryId, { status: 'uploaded', fileKey, publicUrl, previewUrl, error: null })
          )
      })
      .catch((err) => updateSlot(categoryId, { status: 'error', error: err?.message || 'Upload failed' }))
  }

  // A PDF document can't be cropped, collaged, or OCR'd — store it as the single document for the
  // category and upload it as-is (no cropper, no combine, no auto-fill).
  const uploadPdf = (categoryId, category, file) => {
    const prev = slotsRef.current[categoryId]
    if (prev) {
      ;['front', 'back', 'single'].forEach((s) => prev[s]?.url && URL.revokeObjectURL(prev[s].url))
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
    }
    const url = URL.createObjectURL(file)
    setSlots((p) => ({
      ...p,
      [categoryId]: {
        categoryId,
        category: category.categoryName,
        bothSide: category.bothSide,
        single: { file, url },
        isPdf: true,
        previewUrl: url,
        status: 'uploading',
        error: null,
      },
    }))
    uploadService
      .uploadImage(file)
      .then(({ fileKey, publicUrl }) =>
        updateSlot(categoryId, { status: 'uploaded', fileKey, publicUrl, error: null })
      )
      .catch((err) => updateSlot(categoryId, { status: 'error', error: err?.message || 'Upload failed' }))
  }

  const handleSelectRaw = (categoryId, side, rawFile) => {
    const category = categoryById[categoryId]
    if (!category) return
    const check = validateImageFile(rawFile)
    if (!check.ok) {
      toast({ title: 'Invalid file', description: check.error, variant: 'destructive' })
      return
    }
    if (isPdfFile(rawFile)) {
      // Force single mode (a PDF is one document) and upload directly.
      setModes((m) => ({ ...m, [categoryId]: 'single' }))
      uploadPdf(categoryId, category, rawFile)
      return
    }
    setCropper({ categoryId, side, file: rawFile, fileName: `${category.categoryName}-${side}.webp` })
  }

  const handleCropped = (croppedFile) => {
    if (!cropper) return
    const { categoryId, side } = cropper
    const category = categoryById[categoryId]
    setCropper(null)

    const prev = slotsRef.current[categoryId] ?? {}
    if (prev[side]?.url) URL.revokeObjectURL(prev[side].url)
    const sideObj = { file: croppedFile, url: URL.createObjectURL(croppedFile) }
    const nextSlot = {
      ...prev,
      categoryId,
      category: category.categoryName,
      bothSide: category.bothSide,
      // A cropped image is never a PDF — clear any stale PDF flag left by a prior PDF upload+cancel,
      // otherwise the tile would keep showing the PDF placeholder instead of this image.
      isPdf: false,
      [side]: sideObj,
      error: null,
    }
    setSlots((p) => ({ ...p, [categoryId]: nextSlot }))

    if (side === 'single') {
      // Single image (non-bothSide, or a bothSide doc captured on one page).
      uploadSingle(categoryId, croppedFile, sideObj.url)
      runOcr(category, croppedFile)
    } else if (nextSlot.front?.file && nextSlot.back?.file) {
      // Both sides captured → combine, then analyse the combined image.
      uploadCombined(category, nextSlot.front.file, nextSlot.back.file)
    } else {
      updateSlot(categoryId, { status: 'idle' })
    }
  }

  const clearSlot = (categoryId) => {
    setSlots((prev) => {
      const slot = prev[categoryId]
      if (slot) {
        ;['front', 'back', 'single'].forEach((s) => slot[s]?.url && URL.revokeObjectURL(slot[s].url))
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
      }
      const next = { ...prev }
      delete next[categoryId]
      return next
    })
  }

  // Switch a two-sided category between front/back and single-page capture; clears any
  // staged files since the inputs change.
  const handleToggleSingle = (categoryId, isSingle) => {
    clearSlot(categoryId)
    setModes((m) => ({ ...m, [categoryId]: isSingle ? 'single' : 'both' }))
  }

  const handleClearSide = (categoryId, side) => {
    setSlots((prev) => {
      const slot = { ...prev[categoryId] }
      if (slot[side]?.url) URL.revokeObjectURL(slot[side].url)
      delete slot[side]
      if (slot.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl)
        slot.previewUrl = null
      }
      slot.fileKey = null
      slot.status = 'idle'
      slot.error = null
      // Reset the slot's type on cancel so a later re-upload (image OR PDF) starts clean.
      slot.isPdf = false
      return { ...prev, [categoryId]: slot }
    })
  }

  const handleRetry = (categoryId) => {
    const slot = slotsRef.current[categoryId]
    const category = categoryById[categoryId]
    if (!slot || !category) return
    if (slot.single?.file) {
      uploadSingle(categoryId, slot.single.file, slot.single.url)
    } else if (slot.front?.file && slot.back?.file) {
      uploadCombined(category, slot.front.file, slot.back.file)
    }
  }

  const anyUploading = Object.values(slots).some((s) => s.status === 'uploading')
  const requiredComplete = useMemo(
    () => categories.filter((c) => c.isRequired).every((c) => slots[c.categoryId]?.status === 'uploaded'),
    [categories, slots]
  )

  // Leaving step 1 (Documents): if OCR already succeeded/idle, go straight to step 2. If it's still
  // running (or failed), open the scanning popup — it auto-advances on success (effect below) or offers
  // manual entry on failure.
  const handleDocumentsNext = () => {
    if (ocrStatus === 'running' || ocrStatus === 'failed') {
      setScanGateOpen(true)
      return
    }
    setStep(STEP_VEHICLE)
  }

  // While the scanning popup is open, auto-advance the moment OCR finishes successfully.
  useEffect(() => {
    if (scanGateOpen && ocrStatus === 'done') {
      setScanGateOpen(false)
      setStep(STEP_VEHICLE)
    }
  }, [scanGateOpen, ocrStatus])

  // Proceed to step 2 for manual entry (scanning popup's manual option / dismissal).
  const proceedManually = () => {
    setScanGateOpen(false)
    setStep(STEP_VEHICLE)
  }

  // Advance to the next step, validating the current step's fields first (optional steps pass).
  const handleNext = async () => {
    const fields = fieldsForStep[step]
    if (fields && fields.length > 0) {
      const ok = await methods.trigger(fields)
      if (!ok) return
    }
    setStep((s) => s + 1)
  }

  const handleConfirm = async () => {
    const payload = assembleStartPayload(methods.getValues(), Object.values(slots))
    try {
      await onSubmit(payload)
    } catch {
      // The caller's mutation surfaces the error (e.g. the 4113 "open process exists" toast); swallow
      // here so a rejected create doesn't become an unhandled promise rejection.
    }
  }

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={step} completed={Array.from({ length: step }, (_, i) => i)} />

      <div className="min-h-[300px]">
        {step === STEP_DOCUMENTS && (
          <StepUploadDocuments
            categories={categories}
            slots={slots}
            isLoading={categoriesLoading}
            ocrStatus={ocrStatus}
            modes={modes}
            onSelectRaw={handleSelectRaw}
            onClearSide={handleClearSide}
            onRetry={handleRetry}
            onToggleSingle={handleToggleSingle}
          />
        )}
        {step > STEP_DOCUMENTS && step < STEP_REVIEW && (
          <FormProvider {...methods}>
            {step === STEP_VEHICLE && <StepVerifyVehicle />}
            {step === STEP_PERSONS && <StepPersons buyerIdUploaded={buyerIdUploaded} />}
            {step === STEP_REFS_PRICE && <StepReferencesPrices references={references} />}
            {step === STEP_STATUS && <StepStatus allowStatus={categorySource !== 'agent'} />}
          </FormProvider>
        )}
        {step === STEP_REVIEW && (
          <StepReviewSubmit values={methods.getValues()} slots={slots} references={references} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {step === STEP_DOCUMENTS ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {step === STEP_DOCUMENTS && (
            <Button
              onClick={handleDocumentsNext}
              disabled={anyUploading || !requiredComplete}
              title={!requiredComplete ? 'Upload all required documents to continue' : undefined}
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {step >= STEP_VEHICLE && step <= STEP_STATUS && (
            <Button onClick={handleNext}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {step === STEP_REVIEW && (
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
              ) : (
                <><Check className="mr-2 h-4 w-4" /> Create Process</>
              )}
            </Button>
          )}
        </div>
      </div>

      <ImageCropperDialog
        open={Boolean(cropper)}
        file={cropper?.file ?? null}
        fileName={cropper?.fileName}
        onCancel={() => setCropper(null)}
        onCropped={handleCropped}
      />

      <ScanDocumentDialog open={scanGateOpen} status={ocrStatus} onManual={proceedManually} />
    </div>
  )
}
