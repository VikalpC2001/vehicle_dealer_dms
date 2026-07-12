import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Horizontal step indicator for multi-step flows (e.g. the create-process wizard).
 *
 * @param {object} props
 * @param {Array<{ label: string, description?: string }>} props.steps
 * @param {number} props.current - 0-based index of the active step.
 * @param {number[]} [props.completed] - 0-based indexes already completed.
 * @param {(index: number) => void} [props.onStepClick] - Enables back-nav to a visited step.
 */
export function Stepper({ steps, current, completed = [], onStepClick, className }) {
  return (
    <ol className={cn('flex w-full items-center', className)}>
      {steps.map((step, index) => {
        const isCompleted = completed.includes(index) || index < current
        const isActive = index === current
        const clickable = typeof onStepClick === 'function' && (isCompleted || index < current)
        const Circle = clickable ? 'button' : 'div'

        return (
          <li key={step.label} className={cn('flex items-center', index < steps.length - 1 && 'flex-1')}>
            <div className="flex items-center gap-3">
              <Circle
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onStepClick(index) : undefined}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  isActive && 'gradient-bg border-transparent text-white shadow-sm',
                  isCompleted && !isActive && 'gradient-bg border-transparent text-white',
                  !isActive && !isCompleted && 'border-border bg-card text-muted-foreground',
                  clickable && 'cursor-pointer'
                )}
              >
                {isCompleted && !isActive ? <Check className="h-4 w-4" /> : index + 1}
              </Circle>
              <div className="hidden sm:block">
                <p className={cn('text-sm font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-3 h-px flex-1 transition-colors',
                  index < current ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
