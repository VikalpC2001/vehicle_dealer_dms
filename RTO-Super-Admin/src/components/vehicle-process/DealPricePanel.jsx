import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IndianRupee, Pencil, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { processExpenseService } from '@/services/processExpenseService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/** 2-decimal INR formatter (the shared `formatCurrency` is whole-rupee). */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const formatMoney = (n) => inr.format(Number(n ?? 0))

/** Empty is allowed (clears the price); otherwise up to 2 decimals. */
const isValidPrice = (v) => v.trim() === '' || /^\d+(\.\d{1,2})?$/.test(v.trim())

/**
 * The "Deal" card: shows a process's purchase/sale price + gross margin, and lets the dealer
 * set/clear them inline (e.g. record the sale price once a buyer is added). A price can only
 * be set when its counterparty exists — purchase needs a seller, sale needs a buyer — matching
 * the backend invariant. Self-contained: owns its own fetch (`getById`, which carries persons
 * + prices) and refreshes the detail view on save.
 *
 * @param {object} props
 * @param {string} props.processId
 */
export function DealPricePanel({ processId }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [purchase, setPurchase] = useState('')
  const [sale, setSale] = useState('')

  const { data: process, isLoading } = useQuery({
    queryKey: ['vehicle-process', processId],
    queryFn: () => vehicleProcessService.getById(processId),
    enabled: Boolean(processId),
  })

  const persons = process?.persons ?? []
  const hasSeller = persons.some((p) => p.personType === 'SELLER')
  const hasBuyer = persons.some((p) => p.personType === 'BUYER')
  // Shared query with ExpensesPanel → adding/removing an expense there refreshes net profit here.
  const { data: expenses = [] } = useQuery({
    queryKey: ['process-expenses', processId],
    queryFn: () => processExpenseService.getByProcess(processId),
    enabled: Boolean(processId),
  })

  // Round money to whole cents before any sign test/display so binary float drift
  // (e.g. 1000.30 − 1000.00 = 0.2999…) can't paint a break-even deal red or flip a sign.
  const round2 = (n) => Math.round(n * 100) / 100
  const purchasePrice = process?.purchasePrice != null ? Number(process.purchasePrice) : null
  const salePrice = process?.salePrice != null ? Number(process.salePrice) : null
  const margin = purchasePrice != null && salePrice != null ? round2(salePrice - purchasePrice) : null
  const expenseTotal = round2(expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0))
  const netProfit = margin != null ? round2(margin - expenseTotal) : null

  const startEdit = () => {
    setPurchase(purchasePrice != null ? String(purchasePrice) : '')
    setSale(salePrice != null ? String(salePrice) : '')
    setEditing(true)
  }

  const mutation = useMutation({
    mutationFn: () => vehicleProcessService.updateDeal(processId, { purchasePrice: purchase, salePrice: sale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId, 'details'] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      toast({ title: 'Deal updated', variant: 'success' })
      setEditing(false)
    },
    onError: (err) =>
      toast({ title: 'Could not update deal', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const invalid = !isValidPrice(purchase) || !isValidPrice(sale)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <IndianRupee className="h-4 w-4 text-muted-foreground" /> Deal
        </CardTitle>
        {!editing && !isLoading && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deal-purchase">Purchase price (₹)</Label>
                <Input
                  id="deal-purchase"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={purchase}
                  onChange={(e) => setPurchase(e.target.value)}
                  disabled={!hasSeller}
                />
                {!hasSeller && (
                  <p className="text-xs text-muted-foreground">Record the seller first to set a purchase price.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-sale">Sale price (₹)</Label>
                <Input
                  id="deal-sale"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={sale}
                  onChange={(e) => setSale(e.target.value)}
                  disabled={!hasBuyer}
                />
                {!hasBuyer && (
                  <p className="text-xs text-muted-foreground">Add a buyer first to set a sale price.</p>
                )}
              </div>
            </div>
            {invalid && <p className="text-xs text-destructive">Enter valid amounts (up to 2 decimals).</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => mutation.mutate()} disabled={invalid || mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : purchasePrice == null && salePrice == null ? (
          <p className="text-sm text-muted-foreground">
            No prices recorded yet. Use Edit to add the purchase or sale price.
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Purchase price</dt>
              <dd className="text-sm font-medium">{purchasePrice != null ? formatMoney(purchasePrice) : '—'}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Sale price</dt>
              <dd className="text-sm font-medium">{salePrice != null ? formatMoney(salePrice) : '—'}</dd>
            </div>
            {margin != null && (
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Gross margin</dt>
                <dd className={cn('text-sm font-semibold', margin >= 0 ? 'text-success' : 'text-destructive')}>
                  {formatMoney(margin)}
                </dd>
              </div>
            )}
            {margin != null && expenseTotal > 0 && (
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Expenses</dt>
                <dd className="text-sm font-medium">{formatMoney(expenseTotal)}</dd>
              </div>
            )}
            {netProfit != null && (
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">Net profit</dt>
                <dd className={cn('text-sm font-semibold', netProfit >= 0 ? 'text-success' : 'text-destructive')}>
                  {formatMoney(netProfit)}
                </dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
