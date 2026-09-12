import { motion, useReducedMotion } from 'framer-motion'
import { TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * A shadcn TabsList whose active tab is a blue pill that SLIDES between tabs (framer-motion
 * `layoutId`), with a two-layer label so the active text is always white-on-blue (no flash while the
 * pill is mid-slide). Mirrors the vehicle-process detail tabs. Must be used inside a CONTROLLED
 * `<Tabs value={v} onValueChange={setV}>` and given the same `value`.
 *
 * @param {object} props
 * @param {Array<{value: string, label: React.ReactNode}>} props.tabs
 * @param {string} props.value - the active tab value (same as the controlled `<Tabs value>`)
 * @param {string} props.layoutId - unique per mounted list (framer-motion shared-layout id)
 * @param {string} [props.className] - extra classes for the TabsList
 */
export function AnimatedTabsList({ tabs, value, layoutId, className }) {
  const reduceMotion = useReducedMotion()
  return (
    <TabsList className={cn('h-auto flex-wrap justify-start gap-1', className)}>
      {tabs.map((t) => (
        <TabsTrigger
          key={t.value}
          value={t.value}
          className="relative data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:hover:text-foreground"
        >
          {/* Sliding blue pill carries its own white label → active text is always white-on-blue. */}
          {value === t.value && (
            <motion.span
              layoutId={layoutId}
              aria-hidden="true"
              className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm"
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
            >
              {t.label}
            </motion.span>
          )}
          {/* Base label stays readable on the muted track (dark, not white). */}
          <span>{t.label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

/**
 * A TabsContent whose body fades + slides in when its tab becomes active. Radix remounts a tab's
 * content on switch, so the enter animation replays every change. Respects prefers-reduced-motion.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export function AnimatedTabPanel({ value, className, children }) {
  const reduce = useReducedMotion()
  return (
    <TabsContent value={value}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </TabsContent>
  )
}
