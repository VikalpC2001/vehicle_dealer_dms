import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { ExpenseFormDialog } from './ExpenseFormDialog'
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
const getExpenseId = (e) => e?.expenseId ?? e?.id

/** Maps a fetched expense row to the form's field shape. */
const toFormValues = (e) => ({
  label: e.label ?? '',
  amount: String(e.amount ?? ''),
  category: e.category ?? '',
})

/** Builds the API payload from form values (amount → number; blank category → null). */
const toPayload = (v) => ({
  label: v.label,
  amount: Number(v.amount),
  category: v.category?.trim() || null,
})

/**
 * Itemized expenses for a process (RTO fees, repairs, commission, …) with a running total.
 * The `['process-expenses', processId]` query is shared with DealPricePanel, so adding/removing
 * an expense here refreshes the Net profit line there.
 *
 * @param {object} props
 * @param {string} props.processId
 */
export function ExpensesPanel({ processId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['process-expenses', processId],
    queryFn: () => processExpenseService.getByProcess(processId),
    enabled: Boolean(processId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['process-expenses', processId] })

  const createMutation = useMutation({
    mutationFn: (values) => processExpenseService.create({ processId, ...toPayload(values) }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Expense added', variant: 'success' })
      setAddOpen(false)
    },
    onError: (err) => toast({ title: 'Failed to add expense', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => processExpenseService.update(id, toPayload(values)),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Expense updated', variant: 'success' })
      setEditExpense(null)
    },
    onError: (err) => toast({ title: 'Failed to update expense', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => processExpenseService.remove(id),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Expense deleted', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Failed to delete expense', description: getErrorMessage(err), variant: 'destructive' }),
  })

  // Stable identity across unrelated re-renders (e.g. the shared-query refetch after a sibling
  // add/delete) so ExpenseFormDialog's reset() only re-seeds when the edited row actually changes
  // — otherwise it would wipe the user's in-progress edits.
  const editDefaults = useMemo(() => (editExpense ? toFormValues(editExpense) : undefined), [editExpense])
  // Round to cents so float drift never leaks past the 2-dp display.
  const total = Math.round(expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0) * 100) / 100

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-muted-foreground" /> Expenses
        </CardTitle>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Expense
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No expenses recorded. Add costs like RTO fees, repairs, or commission to track net profit.
          </p>
        ) : (
          <>
            <div className="divide-y divide-border">
              {expenses.map((e) => (
                <div key={getExpenseId(e)} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="font-medium">{e.label}</p>
                    {e.category && (
                      <Badge variant="outline" className="mt-1">
                        {e.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="whitespace-nowrap text-sm font-medium">{formatMoney(e.amount)}</span>
                    <Button variant="ghost" size="icon" onClick={() => setEditExpense(e)} aria-label="Edit expense">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(e)} aria-label="Delete expense">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Total expenses</span>
              <span className="font-semibold">{formatMoney(total)}</span>
            </div>
          </>
        )}
      </CardContent>

      <ExpenseFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Expense"
        onSubmit={(v) => createMutation.mutateAsync(v)}
        loading={createMutation.isPending}
        submitLabel="Add"
      />

      <ExpenseFormDialog
        open={Boolean(editExpense)}
        onOpenChange={(open) => !open && setEditExpense(null)}
        title="Edit Expense"
        defaultValues={editDefaults}
        onSubmit={(v) => updateMutation.mutateAsync({ id: getExpenseId(editExpense), values: v })}
        loading={updateMutation.isPending}
        submitLabel="Save Changes"
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete expense"
        description={`Delete "${deleteTarget?.label ?? 'this expense'}"?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getExpenseId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
