import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Stepper } from '@/components/ui/stepper'
import { toast } from '@/hooks/use-toast'
import { dealerWiseUploadCategoryService } from '@/services/dealerWiseUploadCategoryService'
import { dealerReferenceService } from '@/services/dealerReferenceService'
import { uploadService, validateImageFile } from '@/services/uploadService'
import { aiService, getAiErrorMessage } from '@/services/aiService'
import { collageVertical } from '@/lib/image'
import {
  assembleStartPayload,
  isRcCategory,
  isIdProofCategory,
  isBuyerIdCategory,
  mapRcOcrToForm,
  mapIdOcrToForm,
  mapIdProofToPerson,
} from '@/lib/vehicleProcess'
import { StepUploadDocuments } from './StepUploadDocuments'
import { StepVerifyDetails, defaultVehicleProcessValues } from './StepVerifyDetails'
import { StepReviewSubmit } from './StepReviewSubmit'
import { ImageCropperDialog } from './ImageCropperDialog'

const STEPS = [
  { label: 'Documents', description: 'Upload & scan' },
  { label: 'Verify', description: 'Confirm details' },
  { label: 'Review', description: 'Submit' },
]

const VERIFY_FORM_ID = 'vehicle-process-verify-form'

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
 */
export function VehicleProcessWizard({ onSubmit, submitting, onCancel }) {
  const [step, setStep] = useState(0)
  const [slots, setSlots] = useState({}) // keyed by categoryId
  const [modes, setModes] = useState({}) // categoryId -> 'single' | 'both' (bothSide categories only)
  const [cropper, setCropper] = useState(null) // { categoryId, side, file, fileName }
  const [ocrPrefill, setOcrPrefill] = useState({})
  const [ocrStatus, setOcrStatus] = useState('idle')
  const [verifyValues, setVerifyValues] = useState(null)

  const slotsRef = useRef(slots)
  useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['dealer-wise-upload-categories', 'view-in-step'],
    queryFn: () => dealerWiseUploadCategoryService.getViewInStep(),
  })
  const { data: references = [] } = useQuery({
    queryKey: ['dealer-references', 'ddl'],
    queryFn: () => dealerReferenceService.getDdl(),
  })

  const categoryById = useMemo(() => {
    const map = {}
    categories.forEach((c) => {
      map[c.categoryId] = c
    })
    return map
  }, [categories])

  const hasBuyerIdCategory = useMemo(() => categories.some(isBuyerIdCategory), [categories])

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
      const extract = category.processApi
        ? aiService.extractViaProcessApi(category.processApi, file)
        : aiService.analyzeImage(file)
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
    } else if (isIdProofCategory(category)) {
      aiService
        .analyzeIdProof(file)
        .then((data) => {
          const mapped = nonEmpty(mapIdOcrToForm(data))
          setOcrPrefill((prev) => ({
            ...prev,
            sellerName: prev.sellerName || mapped.sellerName || '',
            sellerAddress: prev.sellerAddress || mapped.sellerAddress || '',
          }))
        })
        .catch(() => {})
    }
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
    collageVertical(frontFile, backFile, `${category.categoryName}.jpg`)
      .then((collageFile) => {
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

  const handleSelectRaw = (categoryId, side, rawFile) => {
    const category = categoryById[categoryId]
    if (!category) return
    const check = validateImageFile(rawFile)
    if (!check.ok) {
      toast({ title: 'Invalid image', description: check.error, variant: 'destructive' })
      return
    }
    setCropper({ categoryId, side, file: rawFile, fileName: `${category.categoryName}-${side}.jpg` })
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

  const handleVerifySubmit = (values) => {
    setVerifyValues(values)
    setStep(2)
  }

  const handleConfirm = async () => {
    const payload = assembleStartPayload(verifyValues, Object.values(slots))
    await onSubmit(payload)
  }

  const verifyDefaults = { ...defaultVehicleProcessValues, ...ocrPrefill, ...(verifyValues ?? {}) }

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={step} completed={Array.from({ length: step }, (_, i) => i)} />

      <div className="min-h-[300px]">
        {step === 0 && (
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
        {step === 1 && (
          <StepVerifyDetails
            formId={VERIFY_FORM_ID}
            defaultValues={verifyDefaults}
            references={references}
            buyerIdInStep1={hasBuyerIdCategory}
            onSubmit={handleVerifySubmit}
          />
        )}
        {step === 2 && (
          <StepReviewSubmit values={verifyValues ?? {}} slots={slots} references={references} />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        {step === 0 ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        )}

        {step === 0 && (
          <Button
            onClick={() => setStep(1)}
            disabled={anyUploading || !requiredComplete}
            title={!requiredComplete ? 'Upload all required documents to continue' : undefined}
          >
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        {step === 1 && (
          <Button type="submit" form={VERIFY_FORM_ID}>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        {step === 2 && (
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
            ) : (
              <><Check className="mr-2 h-4 w-4" /> Create Process</>
            )}
          </Button>
        )}
      </div>

      <ImageCropperDialog
        open={Boolean(cropper)}
        file={cropper?.file ?? null}
        fileName={cropper?.fileName}
        onCancel={() => setCropper(null)}
        onCropped={handleCropped}
      />
    </div>
  )
}
