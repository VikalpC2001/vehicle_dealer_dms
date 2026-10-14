import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FileUploadInput } from '@/components/vehicle-process/FileUploadInput'
import { ImageCropperDialog } from '@/components/vehicle-process/ImageCropperDialog'
import { validateImageFile } from '@/services/uploadService'
import { isPdfFile } from '@/lib/vehicleProcess'

/**
 * The form body of {@link UploadFileDialog}. Kept as a separate component so Radix remounts it fresh
 * each time the dialog opens (the state resets on open without a reset effect). Never rendered when
 * the dialog is closed.
 */
function UploadFileForm({
  onOpenChange,
  title,
  description,
  submitLabel,
  submitting,
  withName,
  nameLabel,
  namePlaceholder,
  nameOptions,
  onSubmit,
}) {
  // When `nameOptions` has entries, the free-text name field becomes a required category <Select>
  // whose chosen value plays the exact role the typed name plays (passed as onSubmit's 2nd arg).
  const selectMode = Array.isArray(nameOptions) && nameOptions.length > 0
  const [name, setName] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isPdf, setIsPdf] = useState(false)
  const [error, setError] = useState(null)
  // Raw image awaiting crop (images open the cropper before they're accepted; PDFs skip it).
  const [cropFile, setCropFile] = useState(null)

  // Revoke the current object URL when it changes / on unmount to avoid leaks.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  // Accept a final file (already validated, and cropped when it's an image) into the form.
  const applyFile = (accepted) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setError(null)
    setFile(accepted)
    setPreviewUrl(URL.createObjectURL(accepted))
    setIsPdf(isPdfFile(accepted))
  }

  const handleSelect = (selected) => {
    const check = validateImageFile(selected)
    if (!check.ok) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setError(check.error)
      setFile(null)
      setPreviewUrl(null)
      setIsPdf(false)
      return
    }
    // PDFs can't be cropped — accept directly; images go through the cropper (same as the create wizard).
    if (isPdfFile(selected)) {
      applyFile(selected)
      return
    }
    setError(null)
    setCropFile(selected)
  }

  const handleClear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setIsPdf(false)
    setError(null)
    setCropFile(null)
  }

  const resolvedName = selectMode ? selectedName : name.trim()
  const nameValid = selectMode ? selectedName.length > 0 : (!withName || name.trim().length > 0)
  const canSubmit = Boolean(file) && nameValid && !submitting

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      <div className="space-y-4">
        {selectMode ? (
          <div className="space-y-2">
            <Label htmlFor="upload-file-category">{nameLabel}</Label>
            <Select value={selectedName} onValueChange={setSelectedName}>
              <SelectTrigger id="upload-file-category">
                <SelectValue placeholder="Select a document category" />
              </SelectTrigger>
              <SelectContent>
                {nameOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}{opt.required ? ' *' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : withName && (
          <div className="space-y-2">
            <Label htmlFor="upload-file-name">{nameLabel}</Label>
            <Input
              id="upload-file-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
              maxLength={255}
            />
          </div>
        )}
        <FileUploadInput
          id="upload-file-input"
          label="File"
          showLabel={false}
          status={error ? 'error' : submitting ? 'uploading' : 'idle'}
          previewUrl={previewUrl}
          isPdf={isPdf}
          error={error}
          onSelect={handleSelect}
          onClear={handleClear}
        />
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(file, resolvedName)} disabled={!canSubmit}>
          {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>

      <ImageCropperDialog
        open={Boolean(cropFile)}
        file={cropFile}
        // getCroppedFile emits WebP and sets the extension to match the encoded type, so the passed
        // name only needs a readable base — keep the original base name, with a .webp extension.
        fileName={cropFile ? `${cropFile.name.replace(/\.[^.]+$/, '')}.webp` : 'image.webp'}
        onCancel={() => setCropFile(null)}
        onCropped={(cropped) => {
          setCropFile(null)
          applyFile(cropped)
        }}
      />
    </>
  )
}

/**
 * A small dialog that picks one file (optionally with a free-text name) and hands it back via
 * `onSubmit(file, name)` — the parent owns the actual upload + mutation and closes the dialog on
 * success. Used to add a named document, replace a document's file, and add a vehicle photo. The
 * file is validated client-side on select (matching the upload constraints); the parent drives the
 * busy state through `submitting`. State resets on every open (the form remounts).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.submitLabel]
 * @param {boolean} [props.submitting]
 * @param {boolean} [props.withName] - show a required free-text name field (used as the document category)
 * @param {string} [props.nameLabel]
 * @param {string} [props.namePlaceholder]
 * @param {Array<{ value: string, label: string, required?: boolean }>} [props.nameOptions] - when
 *   non-empty, replaces the free-text name field with a required category <Select>; the chosen value
 *   is passed as onSubmit's 2nd arg (same role the typed name plays).
 * @param {(file: File, name: string) => void} props.onSubmit
 */
export function UploadFileDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = 'Save',
  submitting = false,
  withName = false,
  nameLabel = 'Name',
  namePlaceholder = '',
  nameOptions,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <UploadFileForm
          onOpenChange={onOpenChange}
          title={title}
          description={description}
          submitLabel={submitLabel}
          submitting={submitting}
          withName={withName}
          nameLabel={nameLabel}
          namePlaceholder={namePlaceholder}
          nameOptions={nameOptions}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  )
}
