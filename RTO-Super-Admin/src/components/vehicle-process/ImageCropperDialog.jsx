import { useEffect, useMemo, useRef, useState } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getCroppedFile } from '@/lib/image'

/**
 * Crop a freshly-selected image before it's used/uploaded. The default crop is the whole
 * image, so confirming without adjusting keeps the full photo (cropping is optional-feeling).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {File|null} props.file - The raw selected file to crop.
 * @param {string} [props.fileName] - Output base filename (getCroppedFile emits WebP, .webp).
 * @param {() => void} props.onCancel
 * @param {(croppedFile: File) => void} props.onCropped
 */
export function ImageCropperDialog({ open, file, fileName = 'image.webp', onCancel, onCropped }) {
  const src = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  const imgRef = useRef(null)
  const [crop, setCrop] = useState()
  const [completed, setCompleted] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget
    const full = { unit: 'px', x: 0, y: 0, width, height }
    setCrop(full)
    setCompleted(full)
  }

  const handleConfirm = async () => {
    if (!imgRef.current || !completed?.width || !completed?.height) {
      if (file) onCropped(file)
      return
    }
    setBusy(true)
    try {
      const cropped = await getCroppedFile(imgRef.current, completed, fileName)
      // If encoding failed (null — e.g. an unencodable oversized canvas), fall back to the original
      // selected file so we never hand back nothing/a corrupt file.
      onCropped(cropped || file)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Crop photo</DialogTitle>
          <DialogDescription>Drag to crop, or just use the whole photo.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center rounded-lg bg-muted/30 p-2">
          {src && (
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompleted(c)} className="max-h-[65vh]">
              <img
                ref={imgRef}
                src={src}
                alt="Crop"
                onLoad={onImageLoad}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </ReactCrop>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={busy || !src}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : 'Use Photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
