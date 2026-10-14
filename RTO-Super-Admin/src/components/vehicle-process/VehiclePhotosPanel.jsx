import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, FileText, Plus, Trash2, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { PhotoGalleryDialog } from '@/components/vehicle-process/PhotoGalleryDialog'
import { UploadFileDialog } from '@/components/vehicle-process/UploadFileDialog'
import { uploadService } from '@/services/uploadService'
import { processUploadPhotoService } from '@/services/processUploadPhotoService'
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/** A process holds at most this many free-form vehicle photos (backend-enforced, 409 on exceed). */
const MAX_VEHICLE_PHOTOS = 5

/**
 * Free-form "Vehicle Photos" for a process (`VEHICLE`-kind upload rows, capped at 5). Read-only by
 * default (grid + lightbox). When `editable`, adds an "Add photo" control (disabled at the 5-photo
 * cap) and a per-tile delete. Self-contained mutations invalidate the process details query
 * (`['vehicle-process', processId, 'details']`), which both the dealer and agent-own detail pages use.
 *
 * @param {object} props
 * @param {Array<{processUploadPhotoId?: string, imageName?: string, category?: string, photoUrl: string, isStarred?: boolean}>} [props.vehiclePhotos]
 * @param {string} [props.processId]
 * @param {string} [props.dealerId] - passed by agents managing a dealer; omitted by a dealer.
 * @param {boolean} [props.editable]
 */
export function VehiclePhotosPanel({ vehiclePhotos = [], processId, dealerId, editable = false }) {
  const queryClient = useQueryClient()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const count = vehiclePhotos.length
  const atCap = count >= MAX_VEHICLE_PHOTOS

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId, 'details'] })
    // Vehicle photos drive the list-row profile thumbnail (starredPhotoUrl) — refresh the list too so
    // starring/adding/removing updates the profile image on the list immediately.
    queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
  }

  const createMutation = useMutation({
    mutationFn: async ({ file, name }) => {
      const { fileKey } = await uploadService.uploadImage(file)
      return processUploadPhotoService.create({
        processId,
        category: name,
        imageName: fileKey,
        kind: 'VEHICLE',
        dealerId,
      })
    },
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      toast({ title: 'Photo added', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not add photo', description: getErrorMessage(err) || err.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => processUploadPhotoService.remove(id, dealerId),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast({ title: 'Photo removed', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not remove photo', description: getErrorMessage(err) || err.message, variant: 'destructive' }),
  })

  const setStarredMutation = useMutation({
    mutationFn: (id) => processUploadPhotoService.setStarred(id, dealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Set as profile photo', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not set profile photo', description: getErrorMessage(err) || err.message, variant: 'destructive' }),
  })

  const openGallery = (i) => {
    setGalleryIndex(i)
    setGalleryOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          Vehicle Photos <span className="text-muted-foreground">{count} / {MAX_VEHICLE_PHOTOS}</span>
        </CardTitle>
        {editable && (
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} disabled={atCap}>
            <Plus className="mr-1.5 h-4 w-4" /> Add photo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">No vehicle photos uploaded.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {vehiclePhotos.map((photo, i) => (
              <div
                key={photo.processUploadPhotoId ?? photo.imageName}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30 transition hover:ring-2 hover:ring-primary"
              >
                <button
                  type="button"
                  onClick={() => openGallery(i)}
                  className="block h-full w-full cursor-pointer"
                  aria-label={`View ${photo.category || 'vehicle photo'}`}
                >
                  {isPdfUrl(photo.photoUrl) ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <span className="text-[11px] font-medium">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={toAppImageUrl(photo.photoUrl)}
                      alt={photo.category || 'Vehicle photo'}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                  {photo.category && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-left text-xs font-medium text-white">
                      {photo.category}
                    </span>
                  )}
                </button>

                {/* Persistent profile-photo badge — always visible (even to non-editors) so viewers
                    can tell which photo is the vehicle's profile picture. */}
                {photo.isStarred && (
                  <span
                    className="pointer-events-none absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-card/90 shadow-sm"
                    aria-label="Profile photo"
                    title="Profile photo"
                  >
                    <Star className="h-3.5 w-3.5 fill-current text-warning" />
                  </span>
                )}

                {editable && Boolean(photo.processUploadPhotoId) && (
                  <div className="absolute right-1 top-1 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    {/* Only NON-starred tiles get a star toggle — the starred tile already shows the
                        persistent badge (top-left), so it never renders a second star here. */}
                    {!photo.isStarred && (
                      <button
                        type="button"
                        onClick={() => setStarredMutation.mutate(photo.processUploadPhotoId)}
                        disabled={setStarredMutation.isPending}
                        aria-label="Set as profile photo"
                        title="Set as profile photo"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-card/90 shadow-sm transition hover:bg-card cursor-pointer disabled:opacity-50"
                      >
                        <Star className="h-3.5 w-3.5 text-warning" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(photo)}
                      aria-label="Delete vehicle photo"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-card/90 shadow-sm transition hover:bg-card cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {editable && atCap && (
          <p className="mt-3 text-xs text-muted-foreground">Maximum of {MAX_VEHICLE_PHOTOS} vehicle photos reached.</p>
        )}
      </CardContent>

      <PhotoGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        photos={vehiclePhotos}
        index={galleryIndex}
        onIndexChange={setGalleryIndex}
      />

      {editable && (
        <>
          <UploadFileDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            title="Add vehicle photo"
            description="Name the photo and upload it (max 5 per vehicle)."
            withName
            nameLabel="Photo name"
            namePlaceholder="e.g. Front side, Back side, Left, Right, Engine"
            submitLabel="Add photo"
            submitting={createMutation.isPending}
            onSubmit={(file, name) => createMutation.mutate({ file, name })}
          />

          <ConfirmModal
            open={Boolean(deleteTarget)}
            onOpenChange={(next) => !next && setDeleteTarget(null)}
            title="Delete vehicle photo"
            description="This permanently removes the photo and its file. This cannot be undone."
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
