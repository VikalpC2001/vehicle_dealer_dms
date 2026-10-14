import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileSpreadsheet, FileText, Loader2, Car, Users, Receipt, Wallet, FileImage, Images, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DateRangePicker } from '@/components/common/DateRangePicker'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'
import { PROCESS_STATUSES } from '@/lib/processStatus'
import { cn } from '@/lib/utils'

// Selectable lifecycle statuses (Open + the terminal statuses). Keys MUST match the backend.
const STATUS_OPTIONS = [{ value: 'OPEN', label: 'Open', colour: '#f59e0b' }, ...PROCESS_STATUSES]

// Exportable sections — keys MUST match the backend `EXPORT_SECTIONS` enum.
const SECTIONS = [
  { key: 'vehicle', label: 'Vehicle Details', hint: 'Reg no, make/model, chassis, engine', icon: Car },
  { key: 'persons', label: 'Seller & Buyer', hint: 'Names, mobiles & addresses', icon: Users },
  { key: 'deal', label: 'Deal & Reference', hint: 'Deal no, status, dates, refs', icon: Receipt },
  { key: 'amount', label: 'Amount & Expense', hint: 'Purchase, sale, expenses, profit', icon: Wallet },
  { key: 'documents', label: 'Documents Image', hint: 'Document scans (embedded)', icon: FileImage },
  { key: 'vehicleImages', label: 'Vehicle Image', hint: 'Vehicle photos (embedded)', icon: Images },
]

const selectionOf = (value) => Object.fromEntries(SECTIONS.map((s) => [s.key, value]))

/** Save a Blob to disk by clicking a temporary object-URL anchor. */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// A failed export still arrives as a Blob (the request uses responseType:'blob'); read the JSON back.
async function readExportError(err) {
  const blob = err?.response?.data
  if (blob instanceof Blob) {
    try {
      const parsed = JSON.parse(await blob.text())
      if (parsed?.message) return parsed.message
    } catch {
      // not JSON — fall through to the generic message
    }
  }
  return getErrorMessage(err)
}

/**
 * Export Process Details — pick a date range (defaults to the current month) and which detail
 * sections to include, then download the matching vehicle processes as an Excel workbook or PDF
 * (generated server-side, with details + document & vehicle images laid out together).
 */
export default function ExportProcessDetails() {
  const [range, setRange] = useState(null) // null | { from: Date, to: Date, label: string }
  const [bySoldDate, setBySoldDate] = useState(false) // range filters sold date instead of process date
  const [statusSel, setStatusSel] = useState({}) // default: none selected (none = all / no filter)
  const [selected, setSelected] = useState(() => selectionOf(false)) // default: nothing selected
  const [busy, setBusy] = useState(null) // 'excel' | 'pdf' | null

  const selectedStatuses = useMemo(
    () => STATUS_OPTIONS.filter((s) => statusSel[s.value]).map((s) => s.value),
    [statusSel],
  )
  const allStatuses = selectedStatuses.length === STATUS_OPTIONS.length
  const noStatuses = selectedStatuses.length === 0
  const toggleStatus = (value) => setStatusSel((s) => ({ ...s, [value]: !s[value] }))

  const selectedKeys = useMemo(
    () => SECTIONS.filter((s) => selected[s.key]).map((s) => s.key),
    [selected],
  )
  const allSelected = selectedKeys.length === SECTIONS.length
  const noneSelected = selectedKeys.length === 0

  const toggle = (key) => setSelected((s) => ({ ...s, [key]: !s[key] }))
  const toggleAll = () => setSelected(selectionOf(!allSelected))

  const handleExport = async (format) => {
    if (noneSelected) {
      toast({ title: 'Select at least one section to export', variant: 'destructive' })
      return
    }
    setBusy(format)
    try {
      const { blob, filename, count, truncated } = await vehicleProcessService.exportProcesses({
        format,
        dateFrom: range ? range.from.toISOString() : undefined,
        dateTo: range ? range.to.toISOString() : undefined,
        dateField: bySoldDate ? 'soldDate' : 'processDate',
        statuses: selectedStatuses,
        sections: selectedKeys,
      })
      triggerDownload(blob, filename)
      toast({
        title: `Exported ${count} process${count === 1 ? '' : 'es'}`,
        description: truncated ? 'Some rows/images were capped — narrow the date range for the rest.' : undefined,
        variant: 'success',
      })
    } catch (err) {
      toast({ title: 'Export failed', description: await readExportError(err), variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Export Process Details</h1>
        <p className="mt-1 text-muted-foreground">
          Choose a date range and the details to include, then download as Excel or PDF.
        </p>
      </motion.div>

      {/* Date range: a single-line bar with a Sold Date filter toggle */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
          <span className="text-sm font-semibold">Date range</span>
          <DateRangePicker onChange={setRange} />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={bySoldDate} onCheckedChange={(v) => setBySoldDate(Boolean(v))} aria-label="Filter by sold date" />
            Sold Date
          </label>
          <span className="ml-auto text-xs text-muted-foreground">
            {range
              ? `${range.from.toLocaleDateString('en-IN')} – ${range.to.toLocaleDateString('en-IN')}`
              : 'Defaults to the current month'}
            {bySoldDate ? ' · by sold date' : ''}
          </span>
        </CardContent>
      </Card>

      {/* Status filter: multi-select pills, default all */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
          <span className="text-sm font-semibold">Status</span>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => {
              const on = Boolean(statusSel[s.value])
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleStatus(s.value)}
                  aria-pressed={on}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                    on ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                  )}
                  style={on ? { backgroundColor: s.colour } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? '#ffffff' : s.colour }} />
                  {s.label}
                </button>
              )
            })}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {noStatuses || allStatuses ? 'All statuses — select to filter' : `${selectedStatuses.length} selected`}
          </span>
        </CardContent>
      </Card>

      {/* 2 — Details to include: grid of selectable cards (default none; Select all control) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Details to include</h2>
            <p className="text-xs text-muted-foreground">
              {noneSelected ? 'Nothing selected yet.' : `${selectedKeys.length} of ${SECTIONS.length} selected`}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all sections" />
            Select all
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {SECTIONS.map((s) => {
            const isOn = Boolean(selected[s.key])
            const Icon = s.icon
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={isOn}
                className={cn(
                  'relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
                  isOn
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-muted-foreground/40',
                )}
              >
                <span className="flex items-center justify-between">
                  <Icon className={cn('h-5 w-5', isOn ? 'text-primary' : 'text-muted-foreground')} />
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md border',
                      isOn ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {isOn && <Check className="h-3.5 w-3.5" />}
                  </span>
                </span>
                <span>
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3 — Download: brand-coloured Excel (green) + PDF (red) */}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button
          size="lg"
          onClick={() => handleExport('excel')}
          disabled={busy !== null || noneSelected}
          // `background` (not backgroundColor) overrides the default variant's gradient-bg image.
          style={{ background: '#107C41', color: '#ffffff' }}
          className="border-0 hover:opacity-90 disabled:opacity-50"
        >
          {busy === 'excel' ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing Excel…</>
          ) : (
            <><FileSpreadsheet className="mr-2 h-5 w-5" /> Export Excel</>
          )}
        </Button>
        <Button
          size="lg"
          onClick={() => handleExport('pdf')}
          disabled={busy !== null || noneSelected}
          // `background` (not backgroundColor) overrides the default variant's gradient-bg image.
          style={{ background: '#EC1C24', color: '#ffffff' }}
          className="border-0 hover:opacity-90 disabled:opacity-50"
        >
          {busy === 'pdf' ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing PDF…</>
          ) : (
            <><FileText className="mr-2 h-5 w-5" /> Export PDF</>
          )}
        </Button>
      </div>
    </div>
  )
}
