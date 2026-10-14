import { PenLine, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Shown when the user clicks Next while the RC OCR is still running. Displays an animated card-scanner
 * effect (viewfinder corner brackets + a sweeping scan beam over a mock RC) until OCR finishes — the
 * parent auto-advances on success (`status` → 'done'), and this shows a manual-entry option when OCR
 * fails (`status` → 'failed'). Closing it (X/overlay) also proceeds to manual entry.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {'idle'|'running'|'done'|'failed'} props.status - current OCR status.
 * @param {() => void} props.onManual - proceed to the next step for manual entry.
 */
export function ScanDocumentDialog({ open, status, onManual }) {
  const failed = status === 'failed'

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onManual() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{failed ? 'Couldn’t read the document' : 'Scanning document…'}</DialogTitle>
          <DialogDescription>
            {failed
              ? 'We couldn’t extract the details automatically. You can enter them manually.'
              : 'Reading the RC and filling the details — this only takes a moment.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-3">
          <div className="rc-scan border border-border bg-card shadow-sm" data-failed={failed}>
            <div className="rc-scan__face">
              <span className="rc-scan__chip" />
              <span className="rc-scan__line bg-muted" style={{ width: '72%' }} />
              <span className="rc-scan__line bg-muted" style={{ width: '100%' }} />
              <span className="rc-scan__line bg-muted" style={{ width: '54%' }} />
            </div>
            <span className="rc-scan__beam" aria-hidden="true" />
            <span className="rc-scan__corner rc-scan__corner--tl" />
            <span className="rc-scan__corner rc-scan__corner--tr" />
            <span className="rc-scan__corner rc-scan__corner--bl" />
            <span className="rc-scan__corner rc-scan__corner--br" />
          </div>

          {failed ? (
            <Button onClick={onManual} className="w-full">
              <PenLine className="mr-2 h-4 w-4" /> Enter details manually
            </Button>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
              </p>
              <button
                type="button"
                onClick={onManual}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Enter details manually instead
              </button>
            </>
          )}
        </div>

        <style>{`
          .rc-scan {
            position: relative; width: 190px; height: 124px;
            border-radius: 14px; overflow: hidden;
          }
          .rc-scan__face {
            position: absolute; inset: 0; display: flex; flex-direction: column;
            justify-content: center; gap: 9px; padding: 22px 20px;
          }
          .rc-scan__chip { width: 28px; height: 21px; border-radius: 5px; background: #f59e0b; opacity: 0.9; }
          .rc-scan__line { height: 7px; border-radius: 4px; }
          .rc-scan__corner { position: absolute; width: 16px; height: 16px; border: 0 solid #2563eb; }
          .rc-scan__corner--tl { top: 9px; left: 9px; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 7px; }
          .rc-scan__corner--tr { top: 9px; right: 9px; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 7px; }
          .rc-scan__corner--bl { bottom: 9px; left: 9px; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 7px; }
          .rc-scan__corner--br { bottom: 9px; right: 9px; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 7px; }
          .rc-scan__beam {
            position: absolute; left: 6px; right: 6px; top: 0; height: 24px; border-radius: 6px;
            background: linear-gradient(to bottom, rgba(37,99,235,0) 0%, rgba(37,99,235,0.38) 50%, rgba(37,99,235,0) 100%);
            box-shadow: 0 0 16px 3px rgba(37,99,235,0.45);
            animation: rc-scan-sweep 2.2s ease-in-out infinite;
          }
          .rc-scan[data-failed="true"] .rc-scan__beam { display: none; }
          .rc-scan[data-failed="true"] .rc-scan__corner { border-color: #f59e0b; }
          @keyframes rc-scan-sweep {
            0%   { transform: translateY(-24px); }
            18%  { transform: translateY(-24px); }
            60%  { transform: translateY(124px); }
            100% { transform: translateY(-24px); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
