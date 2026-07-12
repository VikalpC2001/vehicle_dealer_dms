import { Sparkles, Loader2, Info, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { FileUploadInput } from './FileUploadInput'

/** Collage upload status for a two-sided category. */
function CombinedStatus({ slot, onRetry }) {
  const status = slot.status ?? 'idle'
  if (status === 'uploading') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Combining front &amp; back…
      </p>
    )
  }
  if (status === 'uploaded') {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <span className="text-xs text-success">Combined &amp; saved</span>
        {slot.previewUrl && (
          <img src={slot.previewUrl} alt="Combined" className="ml-auto h-12 w-9 rounded border border-border object-cover" />
        )}
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {slot.error || 'Upload failed'}
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onRetry}>
          <RefreshCw className="mr-1 h-3 w-3" /> Retry
        </Button>
      </div>
    )
  }
  return (
    <p className="text-xs text-muted-foreground">Add front and back — they&apos;ll be combined into one image.</p>
  )
}

/**
 * Step 1 — upload the dealer's configured documents (from /dealer-wise-upload-categories/
 * view-in-step). One card per category in orderRank order; required ones are marked.
 * Two-sided categories show Front + Back (combined into one image on save). RC auto-OCRs.
 *
 * @param {object} props
 * @param {Array} props.categories
 * @param {Record<string, object>} props.slots - keyed by categoryId
 * @param {boolean} props.isLoading
 * @param {'idle'|'running'|'done'|'failed'} props.ocrStatus
 * @param {Record<string, 'single'|'both'>} props.modes - Per-category capture mode (bothSide only)
 * @param {(categoryId: string, side: 'single'|'front'|'back', file: File) => void} props.onSelectRaw
 * @param {(categoryId: string, side: 'single'|'front'|'back') => void} props.onClearSide
 * @param {(categoryId: string) => void} props.onRetry
 * @param {(categoryId: string, isSingle: boolean) => void} props.onToggleSingle
 */
export function StepUploadDocuments({
  categories,
  slots,
  isLoading,
  ocrStatus,
  modes = {},
  onSelectRaw,
  onClearSide,
  onRetry,
  onToggleSingle,
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Upload the vehicle documents below — you can crop each photo. When you add the{' '}
          <span className="font-medium text-foreground">Registration Certificate</span>, we read it
          automatically and fill the next step.
          {ocrStatus === 'running' && (
            <span className="ml-1 inline-flex items-center gap-1 text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading document…
            </span>
          )}
          {ocrStatus === 'done' && (
            <span className="ml-1 font-medium text-success">Details captured — verify them next.</span>
          )}
        </p>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              No document categories are configured for your account yet. You can still continue and
              enter the details manually, or set up documents in Settings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {categories.map((category) => {
            const slot = slots[category.categoryId] ?? {}
            const singleMode = !category.bothSide || modes[category.categoryId] === 'single'
            return (
              <Card key={category.dwucId ?? category.categoryId}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1 text-sm font-medium">
                      {category.categoryName}
                      {category.isRequired && <span className="text-destructive">*</span>}
                    </p>
                    <span className="text-xs text-muted-foreground">#{category.orderRank}</span>
                  </div>

                  {category.bothSide && (
                    <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Front &amp; back are on a single page</span>
                      <Switch
                        checked={modes[category.categoryId] === 'single'}
                        onCheckedChange={(v) => onToggleSingle(category.categoryId, v)}
                      />
                    </label>
                  )}

                  {singleMode ? (
                    <FileUploadInput
                      id={`up-${category.categoryId}`}
                      label={category.categoryName}
                      showLabel={false}
                      previewUrl={slot.single?.url ?? null}
                      status={slot.status ?? 'idle'}
                      error={slot.error ?? null}
                      onSelect={(file) => onSelectRaw(category.categoryId, 'single', file)}
                      onClear={() => onClearSide(category.categoryId, 'single')}
                      onRetry={() => onRetry(category.categoryId)}
                    />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <FileUploadInput
                          id={`up-${category.categoryId}-front`}
                          label="Front"
                          previewUrl={slot.front?.url ?? null}
                          status="idle"
                          onSelect={(file) => onSelectRaw(category.categoryId, 'front', file)}
                          onClear={() => onClearSide(category.categoryId, 'front')}
                        />
                        <FileUploadInput
                          id={`up-${category.categoryId}-back`}
                          label="Back"
                          previewUrl={slot.back?.url ?? null}
                          status="idle"
                          onSelect={(file) => onSelectRaw(category.categoryId, 'back', file)}
                          onClear={() => onClearSide(category.categoryId, 'back')}
                        />
                      </div>
                      <CombinedStatus slot={slot} onRetry={() => onRetry(category.categoryId)} />
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
