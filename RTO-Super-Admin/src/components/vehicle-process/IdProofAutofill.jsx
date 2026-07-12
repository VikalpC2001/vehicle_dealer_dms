import { useRef, useState } from 'react'
import { Loader2, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageCropperDialog } from './ImageCropperDialog'
import { aiService, getAiErrorMessage } from '@/services/aiService'
import { validateImageFile } from '@/services/uploadService'
import { mapIdProofToPerson } from '@/lib/vehicleProcess'
import { toast } from '@/hooks/use-toast'

/**
 * Optional "upload an ID proof to auto-fill" control. Pick an image → crop → Gemini
 * ID OCR → calls `onExtracted({ name, address })`. The image is used only for
 * extraction (not stored). If no ID is uploaded, nothing happens (manual entry).
 *
 * @param {object} props
 * @param {(fields: { name: string, address: string }) => void} props.onExtracted
 * @param {string} [props.label]
 * @param {string} [props.className]
 */
export function IdProofAutofill({ onExtracted, label = 'Upload ID to auto-fill', className }) {
  const inputRef = useRef(null)
  const [cropFile, setCropFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const check = validateImageFile(file)
    if (!check.ok) {
      toast({ title: 'Invalid image', description: check.error, variant: 'destructive' })
      return
    }
    setCropFile(file)
  }

  const handleCropped = async (cropped) => {
    setCropFile(null)
    setBusy(true)
    try {
      const data = await aiService.analyzeIdProof(cropped)
      onExtracted(mapIdProofToPerson(data))
      toast({ title: 'Details captured from ID', variant: 'success' })
    } catch (err) {
      toast({ title: 'Could not read ID', description: getAiErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading ID…</>
        ) : (
          <><ScanLine className="mr-2 h-4 w-4" /> {label}</>
        )}
      </Button>
      <ImageCropperDialog
        open={Boolean(cropFile)}
        file={cropFile}
        fileName="id-proof.jpg"
        onCancel={() => setCropFile(null)}
        onCropped={handleCropped}
      />
    </div>
  )
}
