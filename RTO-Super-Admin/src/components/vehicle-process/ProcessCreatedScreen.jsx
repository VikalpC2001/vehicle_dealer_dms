import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { BadgeCheck, Sparkles, Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Stylized scooter (step-through two-wheeler) with continuously spinning wheel groups. */
function ScooterGraphic() {
  const wheelSpin = {
    animate: { rotate: 360 },
    transition: { repeat: Infinity, duration: 0.5, ease: 'linear' },
    style: { transformBox: 'fill-box', transformOrigin: 'center' },
  }
  return (
    <svg
      viewBox="0 0 104 56"
      className="h-16 w-28 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* deck + rear seat body */}
      <path d="M30 43 L60 43" />
      <path d="M30 43 C 26 31, 44 26, 56 30" />
      <path d="M40 27 L56 27" />
      {/* front leg-shield + handlebar + fork */}
      <path d="M60 43 C 61 30, 66 21, 72 18" />
      <path d="M66 17 L80 20" />
      <path d="M73 21 L82 43" />
      <path d="M22 44 L30 44" />
      {/* wheels */}
      <motion.g {...wheelSpin}>
        <circle cx="22" cy="44" r="10" />
        <line x1="22" y1="35" x2="22" y2="53" />
        <line x1="13" y1="44" x2="31" y2="44" />
      </motion.g>
      <motion.g {...wheelSpin}>
        <circle cx="82" cy="44" r="10" />
        <line x1="82" y1="35" x2="82" y2="53" />
        <line x1="73" y1="44" x2="91" y2="44" />
      </motion.g>
    </svg>
  )
}

// Twinkling sparkles arranged around the success badge (position + color + timing per sparkle).
const SPARKLES = [
  { cls: '-top-1 -left-2 text-warning', size: 'h-4 w-4', delay: 0 },
  { cls: '-top-2 right-0 text-primary', size: 'h-3 w-3', delay: 0.5 },
  { cls: 'bottom-0 -left-1 text-success', size: 'h-3.5 w-3.5', delay: 1 },
  { cls: '-bottom-1 right-1 text-warning', size: 'h-3 w-3', delay: 1.4 },
]

/**
 * Full-page animated success shown right after a vehicle process is created. The icon area first plays
 * a scooter "arrival" (rides in, drives off), then hands off to a success badge that pops in and keeps a
 * continuous heartbeat pulse with twinkling sparkles while the user stays on the page. Shows only the
 * vehicle number + model as text (no card), fits one screen (no scroll). Two next actions: create
 * another process, or open the new process's details page.
 *
 * @param {object} props
 * @param {object} [props.vehicle] - the vehicle just submitted (uses registrationNumber + model).
 * @param {() => void} props.onAddNew       - start a fresh process.
 * @param {() => void} props.onViewDetails  - open the created process's detail page.
 */
export function ProcessCreatedScreen({ vehicle = {}, onAddNew, onViewDetails }) {
  const reduce = useReducedMotion()
  // Reduced-motion users skip straight to the (static) success badge.
  const [phase, setPhase] = useState(reduce ? 'success' : 'arriving')

  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setPhase('success'), 1600)
    return () => clearTimeout(t)
  }, [reduce])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center overflow-hidden px-4 py-6 text-center">
      {/* Icon stage — scooter arrival → success badge handoff. */}
      <div className="relative mb-6 flex h-28 w-full max-w-xs items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          {phase === 'arriving' ? (
            <motion.div
              key="scooter"
              className="relative"
              initial={{ x: -200, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 240, opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* speed lines trailing the scooter */}
              <div className="absolute right-full top-1/2 mr-2 flex -translate-y-1/2 flex-col gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-0.5 rounded-full bg-primary/50"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: [0, 22, 0], opacity: [0, 1, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: 'easeOut' }}
                  />
                ))}
              </div>
              <ScooterGraphic />
            </motion.div>
          ) : (
            <motion.div
              key="badge"
              className="relative flex h-24 w-24 items-center justify-center"
              initial={reduce ? false : { scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            >
              {/* twinkling sparkles */}
              {!reduce &&
                SPARKLES.map((s, i) => (
                  <motion.span
                    key={i}
                    className={`absolute ${s.cls}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
                  >
                    <Sparkles className={s.size} />
                  </motion.span>
                ))}
              {/* badge with a continuous heartbeat pulse */}
              <motion.div
                className="flex h-24 w-24 items-center justify-center rounded-full bg-success/15 shadow-lg shadow-success/20"
                animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
                transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <BadgeCheck className="h-14 w-14 text-success" strokeWidth={2.2} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.h1
        className="text-3xl font-bold"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.2 }}
      >
        Process Created Successfully!
      </motion.h1>

      {/* Vehicle number rendered as a number plate; model below. */}
      <motion.div
        className="mt-5 flex flex-col items-center gap-2"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.3 }}
      >
        {vehicle.registrationNumber && (
          // A number plate is a real-world object → deliberately fixed white/black/blue, not theme tokens.
          <div className="inline-flex max-w-full items-stretch overflow-hidden rounded-lg border-[3px] border-neutral-900 bg-white shadow-md">
            <div className="flex flex-col items-center justify-center gap-0.5 bg-blue-700 px-2 py-1.5">
              <span className="h-2 w-3 rounded-[1px] bg-yellow-400" aria-hidden="true" />
              <span className="text-[9px] font-bold leading-none text-white">IND</span>
            </div>
            <span className="px-4 py-2 font-mono text-2xl font-extrabold uppercase tracking-[0.15em] text-neutral-900 sm:px-5 sm:text-3xl">
              {vehicle.registrationNumber}
            </span>
          </div>
        )}
        {vehicle.model && <p className="text-base text-muted-foreground">{vehicle.model}</p>}
      </motion.div>

      <motion.div
        className="mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.45 }}
      >
        <Button className="sm:min-w-44" onClick={onAddNew}>
          <Plus className="mr-2 h-4 w-4" /> Add New Process
        </Button>
        <Button variant="outline" className="sm:min-w-44" onClick={onViewDetails}>
          <FileText className="mr-2 h-4 w-4" /> View Process Details
        </Button>
      </motion.div>
    </div>
  )
}
