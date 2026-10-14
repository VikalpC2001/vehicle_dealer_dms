import * as React from 'react'
import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp'
import { cn } from '@/lib/utils'

/**
 * One box of the code. Purely visual: the real (invisible) input sits on top of the whole row and
 * owns typing, paste, selection and autofill.
 */
function OtpSlot({ char, isActive, hasFakeCaret, invalid }) {
  const filled = char != null && char !== ''
  return (
    <div
      data-otp-box
      // Decoration only: assistive tech reads the real input, not the digits drawn in the boxes.
      aria-hidden="true"
      className={cn(
        'relative flex h-12 min-w-0 max-w-12 flex-1 items-center justify-center rounded-xl border-2 bg-card text-xl font-bold tabular-nums',
        'transition-all duration-200 motion-reduce:transition-none sm:h-14',
        filled ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border text-muted-foreground',
        isActive && 'border-primary shadow-md ring-4 ring-primary/15 motion-safe:-translate-y-0.5',
        invalid && 'border-destructive bg-destructive/5 text-destructive',
        invalid && isActive && 'ring-destructive/15',
      )}
    >
      {filled ? (
        // `key` restarts the pop each time the digit in this box changes.
        <span key={char} className="motion-safe:animate-otp-pop">{char}</span>
      ) : hasFakeCaret ? (
        <span className="h-6 w-0.5 rounded-full bg-primary motion-safe:animate-caret-blink" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-border" />
      )}
      {/* Fills in under each entered digit, so the row reads as progress through the code. */}
      <span
        className={cn(
          'absolute inset-x-2.5 bottom-1.5 h-0.5 origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none',
          invalid ? 'bg-destructive' : 'gradient-bg',
          filled ? 'scale-x-100' : 'scale-x-0',
        )}
      />
    </div>
  )
}

/**
 * Puts the selection on the box that was clicked or tapped. The real input's own (invisible) text
 * is not laid out under the boxes, so without this every click lands on the last digit. A filled
 * box gets its digit selected, so typing replaces it; an empty box means "continue at the end".
 */
function selectClickedBox(event) {
  // A click with no pointer position keeps the default: caret at the end.
  if (event.detail === 0) return
  const input = event.currentTarget
  const row = input.closest('[data-input-otp-container]')
  if (!row) return
  // So does a click that is not on the row: the browser forwards a press on the <label> to the
  // input as an ordinary click (detail 1 in Chrome) that carries the label's coordinates.
  const bounds = row.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
  const boxes = Array.from(row.querySelectorAll('[data-otp-box]'))
  if (boxes.length === 0) return
  let index = 0
  let nearest = Infinity
  boxes.forEach((box, i) => {
    const rect = box.getBoundingClientRect()
    const distance = Math.abs(event.clientX - (rect.left + rect.width / 2))
    if (distance < nearest) {
      nearest = distance
      index = i
    }
  })
  const filled = input.value.length
  if (index < filled) input.setSelectionRange(index, index + 1)
  else input.setSelectionRange(filled, filled)
}

/**
 * One-time-code entry shown as separate boxes, one per digit, split into two groups.
 *
 * Underneath it is a single real text field (via `input-otp`), so typing, Backspace, arrow keys,
 * pasting a whole code and the phone keyboard's "code from message/mail" suggestion all behave as
 * they do in a normal input — the boxes only draw what that field holds.
 *
 * @param {object} props
 * @param {string} props.value - The digits entered so far.
 * @param {(value: string) => void} props.onChange
 * @param {(value: string) => void} [props.onComplete] - Called when every box is filled.
 * @param {number} [props.length=6] - Number of digits.
 * @param {boolean} [props.invalid=false] - Red boxes with a short shake (e.g. wrong code).
 * @param {string} [props.className] - Extra classes for the row of boxes.
 * Any other prop (`id`, `autoFocus`, `disabled`, `aria-label`, …) goes to the underlying input.
 */
const OtpInput = React.forwardRef(({ length = 6, invalid = false, className, onClick, value, onChange, ...props }, ref) => {
  const half = Math.ceil(length / 2)
  // Where the last edit removed a digit, read while the caret still sits there (the library moves
  // the selection straight afterwards).
  const removedAt = React.useRef(null)
  return (
    <OTPInput
      ref={ref}
      maxLength={length}
      inputMode="numeric"
      pattern={REGEXP_ONLY_DIGITS}
      autoComplete="one-time-code"
      // A code copied as "482 913" or "482-913" still pastes.
      pasteTransformer={(pasted) => pasted.replace(/\D/g, '')}
      aria-invalid={invalid || undefined}
      value={value}
      onInputCapture={(event) => {
        const field = event.currentTarget
        removedAt.current = field.value.length === (value ?? '').length - 1 ? field.selectionStart : null
      }}
      onChange={(next) => {
        const current = value ?? ''
        const at = removedAt.current
        removedAt.current = null
        // The one field cannot hold a gap. Removing a digit that is not the last would shift the
        // later digits left and leave the box before it selected, so the next digit typed would
        // land in the wrong box. Clear from the removed box onward instead: it becomes the empty,
        // active box.
        const leavesGap = at !== null && at < next.length && next === current.slice(0, at) + current.slice(at + 1)
        onChange?.(leavesGap ? current.slice(0, at) : next)
      }}
      // Runs before the library's own paste handler, which only replaces the selected box.
      onPasteCapture={(event) => {
        const digits = event.clipboardData.getData('text/plain').replace(/\D/g, '')
        if (digits.length === 0) {
          // Nothing usable: leave the code alone (the library would delete the selected digit).
          event.preventDefault()
          event.stopPropagation()
        } else if (digits.length >= length) {
          // A whole code replaces whatever is there instead of being spliced into the old digits.
          event.currentTarget.setSelectionRange(0, event.currentTarget.value.length)
        }
      }}
      onClick={(event) => {
        selectClickedBox(event)
        onClick?.(event)
      }}
      containerClassName={cn(
        'flex w-full items-center justify-center gap-1.5 has-[:disabled]:opacity-60 sm:gap-2',
        invalid && 'motion-safe:animate-otp-shake',
        className,
      )}
      render={({ slots }) => (
        <>
          {slots.slice(0, half).map((slot, index) => (
            <OtpSlot key={index} {...slot} invalid={invalid} />
          ))}
          <span className="h-1 w-2 shrink-0 rounded-full bg-border sm:w-3" aria-hidden="true" />
          {slots.slice(half).map((slot, index) => (
            <OtpSlot key={half + index} {...slot} invalid={invalid} />
          ))}
        </>
      )}
      {...props}
    />
  )
})
OtpInput.displayName = 'OtpInput'

export { OtpInput }
