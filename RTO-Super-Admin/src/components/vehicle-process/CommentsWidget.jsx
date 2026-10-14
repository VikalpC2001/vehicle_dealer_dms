import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommentsPanel } from './CommentsPanel'
import { commentsService } from '@/services/commentsService'

/**
 * Floating comments button + corner chat popover for a process. Portaled to `<body>` so `fixed`
 * anchors to the viewport (not a transformed ancestor). The button toggles the panel and shows a
 * count badge; the panel slides up from the button and hosts the shared `CommentsPanel` (chat view).
 * Escape closes it (unless focus is in a field). Used on the dealer and agent vehicle-detail pages.
 *
 * @param {object} props
 * @param {string} props.processId
 */
export function CommentsWidget({ processId }) {
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)

  // Drives the count badge; same query key as CommentsPanel → one shared fetch.
  const { data: comments = [] } = useQuery({
    queryKey: ['process-comments', processId],
    queryFn: () => commentsService.list(processId),
    enabled: Boolean(processId),
  })

  // Escape closes the widget — but not while typing (the composer/edit textareas keep Escape).
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const el = document.activeElement
      if (el?.tagName === 'TEXTAREA' || el?.tagName === 'INPUT' || el?.isContentEditable) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!processId) return null

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            id="comments-widget-panel"
            role="dialog"
            aria-label="Comments"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-24 right-6 z-20 flex h-[70vh] max-h-[calc(100vh-12rem)] w-[calc(100vw-3rem)] max-w-[400px] origin-bottom-right flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <CommentsPanel processId={processId} fill className="h-full border-0 shadow-none" />
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-20 h-14 w-14 rounded-full p-0 shadow-lg"
        aria-label={open ? 'Close comments' : `Open comments (${comments.length})`}
        aria-expanded={open}
        aria-controls="comments-widget-panel"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        {!open && comments.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white">
            {comments.length > 99 ? '99+' : comments.length}
          </span>
        )}
      </Button>
    </>,
    document.body,
  )
}
