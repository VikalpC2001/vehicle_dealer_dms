import { useRef } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle, X, RefreshCw, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DOCUMENT_MIME_TYPES } from '@/lib/vehicleProcess'

/**
 * A single image upload slot with preview, status, and per-file retry.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {boolean} [props.required]
 * @param {'idle'|'uploading'|'uploaded'|'error'} props.status
 * @param {string|null} [props.previewUrl]
 * @param {string|null} [props.error]
 * @param {(file: File) => void} props.onSelect
 * @param {() => void} [props.onClear]
 * @param {() => void} [props.onRetry]
 */
export function FileUploadInput({
  id,
  label,
  showLabel = true,
  required = false,
  status = 'idle',
  previewUrl,
  isPdf = false,
  error,
  onSelect,
  onClear,
  onRetry,
}) {
  const inputRef = useRef(null)

  const handleChange = (event) => {
    const file = event.target.files?.[0]
    if (file) onSelect(file)
    // Allow re-selecting the same file name after a clear/error.
    event.target.value = ''
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div className="space-y-2">
      {showLabel && label && (
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      <div
        className={cn(
          'relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center transition-colors',
          status === 'error' && 'border-destructive/50 bg-destructive/5',
          status === 'uploaded' && 'border-success/50 bg-success/5'
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={DOCUMENT_MIME_TYPES.join(',')}
          className="hidden"
          onChange={handleChange}
          aria-invalid={status === 'error'}
        />

        {previewUrl ? (
          <div className="relative">
            {isPdf ? (
              <div className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-md border border-border bg-muted/40 text-muted-foreground">
                <FileText className="h-7 w-7" />
                <span className="text-[11px] font-medium">PDF</span>
              </div>
            ) : (
              <img
                src={previewUrl}
                alt={`${label} preview`}
                className="h-24 w-auto max-w-full rounded-md object-cover"
              />
            )}
            {onClear && status !== 'uploading' && (
              <button
                type="button"
                onClick={onClear}
                aria-label={`Remove ${label}`}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm hover:text-destructive cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Upload className="h-6 w-6" />
            <span className="text-xs font-medium">Click to upload</span>
            <span className="text-[11px]">PNG, JPG, WEBP or PDF · max 5 MB</span>
          </button>
        )}

        <div className="flex min-h-[20px] items-center gap-1.5 text-xs">
          {status === 'uploading' && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
            </span>
          )}
          {status === 'uploaded' && (
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {error || 'Upload failed'}
            </span>
          )}
        </div>

        {status === 'error' && onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </div>
    </div>
  )
}
