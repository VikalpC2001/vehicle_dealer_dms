import { Bike } from 'lucide-react'
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'
import { cn } from '@/lib/utils'

/**
 * Circular profile avatar for a vehicle process — the starred (profile) photo in a clean bordered
 * circle, or a Bike icon in the circular frame when there is no image (or it is a PDF). Size is set by
 * the caller via `className` (e.g. "h-16 w-16"). Pass `onClick` to make it a clickable button (used to
 * open a photo preview); it only becomes clickable when there is an actual image.
 *
 * @param {object} props
 * @param {string} [props.photoUrl] - the starred photo URL (absolute); falls back to the Bike icon.
 * @param {string} [props.className] - size + extra classes for the circular frame.
 * @param {() => void} [props.onClick] - when given (and an image exists), makes the avatar clickable.
 */
export function VehicleAvatar({ photoUrl, className, onClick }) {
  const showImage = photoUrl && !isPdfUrl(photoUrl)
  const clickable = Boolean(onClick) && showImage
  const classes = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted',
    clickable && 'cursor-pointer transition hover:opacity-90',
    className,
  )
  const content = showImage ? (
    <img src={toAppImageUrl(photoUrl)} alt="" className="h-full w-full object-cover" />
  ) : (
    <Bike className="h-1/2 w-1/2 text-muted-foreground" aria-hidden="true" />
  )

  if (clickable) {
    return (
      <button type="button" onClick={onClick} aria-label="View vehicle photo" className={classes}>
        {content}
      </button>
    )
  }
  return <div className={classes}>{content}</div>
}
