import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Absolute overlay shown inside a person dialog while an uploaded ID is being OCR-read. `status`:
 *   'scanning' → animated card-scanner (beam + corner brackets) + a manual-entry escape (`onManual`);
 *   'failed'   → message + "Enter details manually" (calls `onManual` to dismiss and type);
 *   null/undefined → hidden.
 * The parent must be `position: relative`.
 *
 * @param {object} props
 * @param {'scanning'|'failed'|null} props.status
 * @param {() => void} props.onManual
 */
export function IdScanOverlay({ status, onManual }) {
  const failed = status === 'failed'
  return (
    <AnimatePresence>
      {status && (
        <motion.div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-md bg-card/95 text-center backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="id-scan border border-border bg-card shadow-sm" data-failed={failed}>
            <div className="id-scan__face">
              <span className="id-scan__chip" />
              <span className="id-scan__line bg-muted" style={{ width: '72%' }} />
              <span className="id-scan__line bg-muted" style={{ width: '100%' }} />
              <span className="id-scan__line bg-muted" style={{ width: '54%' }} />
            </div>
            <span className="id-scan__beam" aria-hidden="true" />
            <span className="id-scan__corner id-scan__corner--tl" />
            <span className="id-scan__corner id-scan__corner--tr" />
            <span className="id-scan__corner id-scan__corner--bl" />
            <span className="id-scan__corner id-scan__corner--br" />
          </div>

          {failed ? (
            <div className="space-y-2 px-6">
              <p className="text-sm text-muted-foreground">Couldn’t read the ID automatically.</p>
              <Button size="sm" onClick={onManual}>
                <PenLine className="mr-1.5 h-4 w-4" /> Enter details manually
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning ID…
              </p>
              {/* Escape hatch so a slow/stuck scan never blocks the form — bail straight to typing. */}
              <button
                type="button"
                onClick={onManual}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Enter details manually
              </button>
            </div>
          )}

          <style>{`
            .id-scan { position: relative; width: 180px; height: 116px; border-radius: 14px; overflow: hidden; }
            .id-scan__face { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 9px; padding: 20px 18px; }
            .id-scan__chip { width: 26px; height: 20px; border-radius: 5px; background: #f59e0b; opacity: 0.9; }
            .id-scan__line { height: 7px; border-radius: 4px; }
            .id-scan__corner { position: absolute; width: 15px; height: 15px; border: 0 solid #2563eb; }
            .id-scan__corner--tl { top: 9px; left: 9px; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 7px; }
            .id-scan__corner--tr { top: 9px; right: 9px; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 7px; }
            .id-scan__corner--bl { bottom: 9px; left: 9px; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 7px; }
            .id-scan__corner--br { bottom: 9px; right: 9px; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 7px; }
            .id-scan__beam { position: absolute; left: 6px; right: 6px; top: 0; height: 22px; border-radius: 6px;
              background: linear-gradient(to bottom, rgba(37,99,235,0), rgba(37,99,235,0.38), rgba(37,99,235,0));
              box-shadow: 0 0 16px 3px rgba(37,99,235,0.45); animation: id-scan-sweep 2s ease-in-out infinite; }
            .id-scan[data-failed="true"] .id-scan__beam { display: none; }
            .id-scan[data-failed="true"] .id-scan__corner { border-color: #f59e0b; }
            @keyframes id-scan-sweep { 0% { transform: translateY(-22px); } 18% { transform: translateY(-22px); } 60% { transform: translateY(116px); } 100% { transform: translateY(-22px); } }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
