import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Horizontal step indicator for multi-step flows (e.g. the create-process wizard). Each step is a
 * numbered circle with its name centered BELOW it in small text; a connecting line runs between the
 * circles and fills up to the active step.
 *
 * @param {object} props
 * @param {Array<{ label: string }>} props.steps - Each step's `label` is shown under its number.
 * @param {number} props.current - 0-based index of the active step.
 * @param {number[]} [props.completed] - 0-based indexes already completed.
 * @param {(index: number) => void} [props.onStepClick] - Enables back-nav to a visited step.
 */
export function Stepper({ steps, current, completed = [], onStepClick, className }) {
  return (
    <ol className={cn('flex w-full items-start', className)}>
      {steps.map((step, index) => {
        const isCompleted = completed.includes(index) || index < current
        const isActive = index === current
        const clickable = typeof onStepClick === 'function' && (isCompleted || index < current)
        const Circle = clickable ? 'button' : 'div'
        const isLast = index === steps.length - 1

        return (
          <li key={step.label} className="flex flex-1 flex-col items-center">
            {/* Circle flanked by connector segments so the line stays continuous across steps. */}
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1 transition-colors',
                  index === 0 ? 'invisible' : index <= current ? 'bg-primary' : 'bg-border'
                )}
              />
              <Circle
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onStepClick(index) : undefined}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  isActive && 'gradient-bg border-0 text-white shadow-sm',
                  isCompleted && !isActive && 'gradient-bg border-0 text-white',
                  !isActive && !isCompleted && 'border-border bg-card text-muted-foreground',
                  clickable && 'cursor-pointer'
                )}
              >
                {isCompleted && !isActive ? <Check className="h-4 w-4" /> : index + 1}
              </Circle>
              <span
                className={cn(
                  'h-0.5 flex-1 transition-colors',
                  isLast ? 'invisible' : index < current ? 'bg-primary' : 'bg-border'
                )}
              />
            </div>
            <p
              className={cn(
                'mt-1.5 px-1 text-center text-[11px] font-medium leading-tight',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
