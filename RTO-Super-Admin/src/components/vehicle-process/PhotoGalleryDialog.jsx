import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Loader2, Printer, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'
import { printDocument } from '@/lib/printShare'
import { downloadFileFromUrl, extOf } from '@/lib/zip'
import { toast } from '@/hooks/use-toast'

/** Horizontal slide+fade keyed on nav direction (next → new enters from the right, and vice-versa). */
const slideVariants = {
  enter: (dir) => ({ x: dir >= 0 ? 120 : -120, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir >= 0 ? -120 : 120, opacity: 0 }),
}

/**
 * Full-screen gallery lightbox for a process's documents — a blurred black overlay (portaled to
 * <body>), with side arrows / ← → keys / a thumbnail strip, and a slide animation on photo change.
 * Images render fitted (object-contain, never cropped); PDFs render in an iframe. Controlled — the
 * parent owns the current index.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {Array<{photoUrl: string, category?: string, imageName?: string, processUploadPhotoId?: string}>} props.photos
 * @param {number} props.index - current photo index
 * @param {(index: number) => void} props.onIndexChange
 */
export function PhotoGalleryDialog({ open, onOpenChange, photos = [], index = 0, onIndexChange = () => {} }) {
  const reduce = useReducedMotion()
  const [direction, setDirection] = useState(0)
  const [printing, setPrinting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const activeThumbRef = useRef(null)
  const containerRef = useRef(null)
  const restoreRef = useRef(null)
  const downOnBackdropRef = useRef(false)
  const count = photos.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(count - 1, 0))

  const change = (nextIndex, dir) => {
    setDirection(dir)
    onIndexChange(nextIndex)
  }
  const go = (dir) => change((safeIndex + dir + count) % count, dir)
  const jump = (i) => change(i, i >= safeIndex ? 1 : -1)

  // ← / → navigate, Esc closes.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      } else if (count > 1 && e.key === 'ArrowRight') {
        setDirection(1)
        onIndexChange((safeIndex + 1) % count)
      } else if (count > 1 && e.key === 'ArrowLeft') {
        setDirection(-1)
        onIndexChange((safeIndex - 1 + count) % count)
      } else if (e.key === 'Tab') {
        // Trap focus within the viewer.
        const container = containerRef.current
        if (!container) return
        const focusables = container.querySelectorAll(
          'a[href],button:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])',
        )
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !container.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !container.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, count, safeIndex, onIndexChange, onOpenChange])

  // Lock background scroll while the viewer is open.
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Keep the active thumbnail centered in the strip.
  useEffect(() => {
    if (open) activeThumbRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [open, safeIndex])

  // Move focus into the viewer on open; restore it to the trigger on close.
  useEffect(() => {
    if (!open) return undefined
    restoreRef.current = document.activeElement
    containerRef.current?.focus()
    return () => {
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [open])

  const current = photos[safeIndex]
  const src = current ? toAppImageUrl(current.photoUrl) : null
  const pdf = current ? isPdfUrl(current.photoUrl) : false
  const label = current?.category || 'Document'

  const handlePrint = async () => {
    if (!current) return
    setPrinting(true)
    try {
      await printDocument({ photoUrl: current.photoUrl, imageName: current.imageName })
    } catch (err) {
      toast({ title: 'Could not print', description: err.message, variant: 'destructive' })
    } finally {
      setPrinting(false)
    }
  }

  const handleDownload = async () => {
    if (!current) return
    setDownloading(true)
    try {
      const base =
        String(current.category || current.imageName || 'document')
          .replace(/\.[^.]+$/, '')
          .replace(/[\\/:*?"<>|]+/g, '-') || 'document'
      await downloadFileFromUrl(current.photoUrl, `${base}.${extOf(current.imageName, pdf ? 'pdf' : 'jpg')}`)
    } catch (err) {
      toast({ title: 'Could not download', description: err.message, variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Document viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-xl focus:outline-none"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
            <div className="min-w-0 truncate text-sm font-medium">
              {label}
              {count > 1 && <span className="ml-2 text-white/60">{safeIndex + 1} / {count}</span>}
            </div>
            <div className="flex items-center gap-1">
              {src && (
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={printing}
                  className="rounded-md p-2 text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                  aria-label="Print document"
                >
                  {printing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                </button>
              )}
              {src && (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="rounded-md p-2 text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                  aria-label="Download document"
                >
                  {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                </button>
              )}
              {src && (
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                  aria-label="Open in new tab"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Close viewer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Main viewer */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {count > 1 && (
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous document"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={safeIndex}
                custom={direction}
                variants={reduce ? undefined : slideVariants}
                initial={reduce ? { opacity: 0 } : 'enter'}
                animate={reduce ? { opacity: 1 } : 'center'}
                exit={reduce ? { opacity: 0 } : 'exit'}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute inset-0 flex items-center justify-center p-4 sm:px-16"
                onMouseDown={(e) => {
                  downOnBackdropRef.current = e.target === e.currentTarget
                }}
                onClick={(e) => {
                  // Close only on a genuine click on the dark padding (not a drag off the image).
                  if (e.target === e.currentTarget && downOnBackdropRef.current) onOpenChange(false)
                }}
              >
                {!src ? (
                  <p className="text-sm text-white/70">No document to preview.</p>
                ) : pdf ? (
                  <iframe src={src} title={label} className="h-full w-full max-w-4xl rounded-md border-0 bg-white" />
                ) : (
                  <img
                    src={src}
                    alt={label}
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {count > 1 && (
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next document"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Thumbnail strip */}
          {count > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 sm:justify-center">
              {photos.map((photo, i) => {
                const isActive = i === safeIndex
                return (
                  <button
                    key={photo.processUploadPhotoId ?? photo.imageName ?? i}
                    ref={isActive ? activeThumbRef : null}
                    type="button"
                    onClick={() => jump(i)}
                    aria-label={`Go to ${photo.category || `document ${i + 1}`}`}
                    aria-current={isActive}
                    className={cn(
                      'relative flex aspect-square h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-white/5 transition',
                      isActive ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100',
                    )}
                  >
                    {isPdfUrl(photo.photoUrl) ? (
                      <FileText className="h-6 w-6 text-white/70" />
                    ) : (
                      <img
                        src={toAppImageUrl(photo.photoUrl)}
                        alt={photo.category || `Document ${i + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
