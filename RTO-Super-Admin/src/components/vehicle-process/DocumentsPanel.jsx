import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, AlertTriangle, Pencil, Trash2, Download, Printer, Share2, Loader2, MoreVertical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { PhotoGalleryDialog } from '@/components/vehicle-process/PhotoGalleryDialog'
import { UploadFileDialog } from '@/components/vehicle-process/UploadFileDialog'
import { ShareDialog } from '@/components/vehicle-process/ShareDialog'
import { uploadService } from '@/services/uploadService'
import { processUploadPhotoService } from '@/services/processUploadPhotoService'
import { dealerWiseUploadCategoryService } from '@/services/dealerWiseUploadCategoryService'
import { agentWiseUploadCategoryService } from '@/services/agentWiseUploadCategoryService'
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'
import { printDocument, shareDocument } from '@/lib/printShare'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/**
 * The document grid + full-screen lightbox for a vehicle process's `DOCUMENT` photos. Read-only by
 * default (visually identical to the old inline grid). When `editable`, adds an "Add document"
 * dialog and a per-tile hover overlay with Replace + Delete — but only for real
 * `process_upload_photo` rows (`processUploadPhotoId` set); legacy rows have no edit/delete endpoint
 * and show no overlay. Self-contained mutations invalidate the process details query
 * (`['vehicle-process', processId, 'details']`), which both the dealer and agent-own detail pages use.
 *
 * @param {object} props
 * @param {Array<{processUploadPhotoId?: string, imageName?: string, category?: string, photoUrl: string}>} [props.photos]
 * @param {string} [props.processId]
 * @param {string} [props.dealerId] - passed by agents managing a dealer; omitted by a dealer.
 * @param {boolean} [props.editable]
 * @param {() => void} [props.onExport] - when provided, renders an "Export ZIP" button beside "Add document".
 * @param {boolean} [props.exporting] - export-in-progress state for the Export ZIP button.
 */
export function DocumentsPanel({ photos = [], processId, dealerId, editable = false, onExport, exporting = false }) {
  const queryClient = useQueryClient()
  const isAgent = Boolean(dealerId)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [addMissingOpen, setAddMissingOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [printingKey, setPrintingKey] = useState(null)
  const [sharingKey, setSharingKey] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId, 'details'] })

  // Step-1 document checklist the process was created against (dealer or agent mirror). Used to offer
  // "add missing document" for categories that were skipped. Only fetched when the panel is editable.
  const categoryService = isAgent ? agentWiseUploadCategoryService : dealerWiseUploadCategoryService
  const { data: checklist = [] } = useQuery({
    queryKey: [isAgent ? 'agent-wise-upload-categories' : 'dealer-wise-upload-categories', 'view-in-step'],
    queryFn: () => categoryService.getViewInStep(),
    enabled: editable,
  })

  // Case-insensitive set of already-uploaded category names; remaining preserves the service's order.
  const uploaded = new Set(photos.map((p) => (p.category || '').trim().toLowerCase()).filter(Boolean))
  const remainingCategories = checklist.filter(
    (c) => !uploaded.has((c.categoryName || '').trim().toLowerCase())
  )
  const missingOptions = remainingCategories.map((c) => ({
    value: c.categoryName,
    label: c.categoryName,
    required: c.isRequired,
  }))

  const handlePrint = async (photo) => {
    const key = photo.processUploadPhotoId ?? photo.imageName
    setPrintingKey(key)
    try {
      await printDocument({ photoUrl: photo.photoUrl, imageName: photo.imageName })
    } catch (err) {
      toast({ title: 'Could not print document', description: err.message, variant: 'destructive' })
    } finally {
      setPrintingKey(null)
    }
  }

  // Share the REAL file via the native share sheet (mobile + HTTPS → attaches the image/PDF in WhatsApp/
  // Mail). When that isn't available (insecure http/LAN origin, or desktop), fall back to the custom
  // WhatsApp/email LINK modal. The fallback open is deferred so a mobile dropdown (menu item → this
  // handler) fully closes first, avoiding a Radix focus/scroll-lock clash between the two layers.
  const handleShare = async (photo) => {
    const key = photo.processUploadPhotoId ?? photo.imageName
    setSharingKey(key)
    try {
      const result = await shareDocument({
        photoUrl: photo.photoUrl,
        imageName: photo.imageName,
        title: photo.category,
      })
      if (result?.unsupported) setTimeout(() => setShareTarget(photo), 0)
    } finally {
      setSharingKey(null)
    }
  }

  const createMutation = useMutation({
    mutationFn: async ({ file, name }) => {
      const { fileKey } = await uploadService.uploadImage(file)
      return processUploadPhotoService.create({ processId, category: name, imageName: fileKey, dealerId })
    },
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      setAddMissingOpen(false)
      toast({ title: 'Document added', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not add document', description: getErrorMessage(err) || err.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, category, file }) => {
      const { fileKey } = await uploadService.uploadImage(file)
      return processUploadPhotoService.update(id, { category, imageName: fileKey }, dealerId)
    },
    onSuccess: () => {
      invalidate()
      setEditTarget(null)
      toast({ title: 'Document replaced', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not replace document', description: getErrorMessage(err) || err.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => processUploadPhotoService.remove(id, dealerId),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast({ title: 'Document removed', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not remove document', description: getErrorMessage(err) || err.message, variant: 'destructive' }),
  })

  const openGallery = (i) => {
    setGalleryIndex(i)
    setGalleryOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Documents ({photos.length})
        </CardTitle>
        {(editable || onExport) && (
          <div className="flex flex-wrap justify-end gap-2">
            {editable && (
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add document
              </Button>
            )}
            {editable && remainingCategories.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddMissingOpen(true)}
                className="border-warning text-warning hover:bg-warning/10 hover:text-warning"
                title={`${remainingCategories.length} document ${remainingCategories.length === 1 ? 'category is' : 'categories are'} still missing`}
              >
                <AlertTriangle className="mr-1.5 h-4 w-4" /> Add missing document ({remainingCategories.length})
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} disabled={!photos.length || exporting}>
                {exporting ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Exporting…</>
                ) : (
                  <><Download className="mr-1.5 h-4 w-4" /> Export ZIP</>
                )}
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, i) => {
            const canManage = editable && Boolean(photo.processUploadPhotoId)
            const docKey = photo.processUploadPhotoId ?? photo.imageName
            return (
              <div
                key={photo.processUploadPhotoId ?? photo.imageName}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30 transition hover:ring-2 hover:ring-primary"
              >
                {/* Preview layer (non-interactive) with a transparent click button over it, so PDFs can
                    render a real first-page preview via <object> while the tile stays click-to-open. */}
                {isPdfUrl(photo.photoUrl) ? (
                  <object
                    data={`${toAppImageUrl(photo.photoUrl)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    type="application/pdf"
                    aria-label={photo.category || 'PDF document'}
                    className="pointer-events-none h-full w-full bg-white"
                  >
                    {/* Fallback when a browser refuses to render PDFs inline. */}
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <span className="text-[11px] font-medium">PDF</span>
                    </div>
                  </object>
                ) : (
                  <img
                    src={toAppImageUrl(photo.photoUrl)}
                    alt={photo.category}
                    className="pointer-events-none h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                <button
                  type="button"
                  onClick={() => openGallery(i)}
                  className="absolute inset-0 z-[1] cursor-pointer"
                  aria-label={`View ${photo.category || 'document'}`}
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-left text-xs font-medium text-white">
                  {photo.category}
                </span>

                {photo.photoUrl && (
                  <>
                    {/* Desktop: hover-revealed icon row (no hover on touch, so hidden below sm). */}
                    <div className="absolute right-1 top-1 z-10 hidden gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 sm:flex">
                      <button
                        type="button"
                        onClick={() => handlePrint(photo)}
                        disabled={printingKey === docKey}
                        aria-label={`Print ${photo.category || 'document'}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-card/90 text-foreground shadow-sm transition hover:bg-card cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {printingKey === docKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Printer className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShare(photo)}
                        disabled={sharingKey === docKey}
                        aria-label={`Share ${photo.category || 'document'}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-card/90 text-foreground shadow-sm transition hover:bg-card cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sharingKey === docKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditTarget(photo)}
                            aria-label={`Replace ${photo.category || 'document'}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-card/90 text-foreground shadow-sm transition hover:bg-card cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(photo)}
                            aria-label={`Delete ${photo.category || 'document'}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-card/90 shadow-sm transition hover:bg-card cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Mobile: always-visible three-dot menu with the same actions (touch has no hover). */}
                    <div className="absolute right-1 top-1 z-10 sm:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${photo.category || 'document'}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-card/90 text-foreground shadow-sm transition hover:bg-card cursor-pointer"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => handlePrint(photo)} disabled={printingKey === docKey}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleShare(photo)}>
                            <Share2 className="mr-2 h-4 w-4" /> Share
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => setEditTarget(photo)}>
                                <Pencil className="mr-2 h-4 w-4" /> Replace
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => setDeleteTarget(photo)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
        )}
      </CardContent>

      <PhotoGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        photos={photos}
        index={galleryIndex}
        onIndexChange={setGalleryIndex}
      />

      {/* Fallback share menu when the native share sheet is unavailable (works for read-only viewers too). */}
      <ShareDialog
        open={Boolean(shareTarget)}
        onOpenChange={(next) => !next && setShareTarget(null)}
        photo={shareTarget}
      />

      {editable && (
        <>
          <UploadFileDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            title="Add document"
            description="Give the document a name, then upload an image or PDF."
            withName
            nameLabel="Document name"
            namePlaceholder="e.g. Vechan Karar"
            submitLabel="Add document"
            submitting={createMutation.isPending}
            onSubmit={(file, name) => createMutation.mutate({ file, name })}
          />

          <UploadFileDialog
            open={addMissingOpen}
            onOpenChange={setAddMissingOpen}
            title="Add missing document"
            description="Pick a document category from your checklist, then upload an image or PDF."
            nameOptions={missingOptions}
            nameLabel="Document category"
            submitLabel="Add document"
            submitting={createMutation.isPending}
            onSubmit={(file, name) => createMutation.mutate({ file, name })}
          />

          <UploadFileDialog
            open={Boolean(editTarget)}
            onOpenChange={(next) => !next && setEditTarget(null)}
            title="Replace document"
            description={editTarget ? `Upload a new file for “${editTarget.category}”.` : undefined}
            submitLabel="Replace"
            submitting={updateMutation.isPending}
            onSubmit={(file) =>
              updateMutation.mutate({ id: editTarget.processUploadPhotoId, category: editTarget.category, file })
            }
          />

          <ConfirmModal
            open={Boolean(deleteTarget)}
            onOpenChange={(next) => !next && setDeleteTarget(null)}
            title="Delete document"
            description="This permanently removes the document and its file. This cannot be undone."
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={() => deleteMutation.mutate(deleteTarget.processUploadPhotoId)}
            loading={deleteMutation.isPending}
          />
        </>
      )}
    </Card>
  )
}
