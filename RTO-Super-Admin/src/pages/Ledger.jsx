import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Loader2, Plus, RotateCcw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { DataTable } from '@/components/tables/DataTable'
import { khataService } from '@/services/khataService'
import { dealerAgentService } from '@/services/dealerAgentService'
import { processAssignmentService } from '@/services/processAssignmentService'
import { useAuth } from '@/context/AuthContext'
import { getErrorMessage, parseValidationErrors } from '@/lib/authErrors'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

/** 2-decimal INR formatter (the shared `formatCurrency` is whole-rupee — not used here). */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const formatMoney = (n) => inr.format(Number(n ?? 0))

/**
 * Labels the dealer-perspective `balance` for the logged-in role.
 * `balance > 0` ⇒ the dealer owes the agent (never negate per role — only re-label).
 *
 * @param {number} balance - signed balance (dealer perspective)
 * @param {'dealer'|'agent'} role
 * @param {string} [counterparty] - counterparty display name for the "{name} owes you" copy
 * @returns {{ text: string, tone: 'success'|'warning'|'muted' }}
 */
function balanceLabel(balance, role, counterparty = 'They') {
  const value = Number(balance ?? 0)
  if (value === 0) return { text: 'Settled', tone: 'muted' }

  const owesYou = formatMoney(Math.abs(value))
  if (value > 0) {
    return role === 'dealer'
      ? { text: `You owe ${owesYou}`, tone: 'warning' }
      : { text: `${counterparty} owes you ${owesYou}`, tone: 'success' }
  }
  // value < 0
  return role === 'dealer'
    ? { text: `${counterparty} owes you ${owesYou}`, tone: 'success' }
    : { text: `You owe ${owesYou}`, tone: 'warning' }
}

const TONE_BADGE = { success: 'success', warning: 'warning', muted: 'secondary' }
const TONE_TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  muted: 'text-muted-foreground',
}

// ---- Entry form (co-located zod schema, mirrors DealerForm) ----

export const entrySchema = z.object({
  counterpartyId: z.string().min(1, 'Select a counterparty'),
  direction: z.enum(['CREDIT', 'DEBIT']),
  amount: z
    .number({ invalid_type_error: 'Enter an amount' })
    .positive('Amount must be greater than 0')
    .refine((v) => Number.isFinite(v) && Math.round(v * 100) === v * 100, {
      message: 'Up to 2 decimal places',
    }),
  description: z.string().max(500, 'Description is too long').optional(),
})

export const defaultEntryValues = {
  counterpartyId: '',
  direction: 'CREDIT',
  amount: '',
  description: '',
}

function EntryForm({
  counterpartyLabel,
  counterpartyOptions,
  lockedCounterparty,
  onSubmit,
  loading,
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      ...defaultEntryValues,
      counterpartyId: lockedCounterparty?.id ?? '',
    },
  })

  const direction = watch('direction')
  const counterpartyId = watch('counterpartyId')

  const handleFormSubmit = async (values) => {
    try {
      await onSubmit({
        counterpartyId: values.counterpartyId,
        direction: values.direction,
        amount: values.amount,
        description: values.description?.trim() || undefined,
      })
    } catch (err) {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => {
        setError(field, { message })
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="counterpartyId">{counterpartyLabel}</Label>
        {lockedCounterparty ? (
          <Input
            id="counterpartyId"
            value={lockedCounterparty.name}
            disabled
            readOnly
          />
        ) : (
          <Select value={counterpartyId} onValueChange={(v) => setValue('counterpartyId', v, { shouldValidate: true })}>
            <SelectTrigger id="counterpartyId">
              <SelectValue placeholder={`Select ${counterpartyLabel.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {counterpartyOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {errors.counterpartyId && (
          <p className="text-sm text-destructive">{errors.counterpartyId.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Direction</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'CREDIT', title: 'Credit' },
            { value: 'DEBIT', title: 'Debit' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('direction', opt.value, { shouldValidate: true })}
              className={cn(
                'rounded-lg border p-3 text-left text-sm transition-colors cursor-pointer',
                direction === opt.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
              )}
            >
              <span className="font-semibold">{opt.title}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Credit raises what the dealer owes the agent; Debit lowers it.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('amount', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
        />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="e.g. Agent fee for name transfer"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...
          </>
        ) : (
          'Post entry'
        )}
      </Button>
    </form>
  )
}

// ---- Page ----

export default function Ledger() {
  const { user } = useAuth()
  const role = user?.role === 'agent' ? 'agent' : 'dealer'
  const counterpartyLabel = role === 'dealer' ? 'Agent' : 'Dealer'
  const queryClient = useQueryClient()

  const [selected, setSelected] = useState(null) // { id, name } | null
  const [entryOpen, setEntryOpen] = useState(false)
  const [reverseTarget, setReverseTarget] = useState(null)
  const [settleOpen, setSettleOpen] = useState(false)

  const counterpartyIdOf = (account) =>
    role === 'dealer' ? account.agentId : account.dealerId

  // Accounts list
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['khata-accounts'],
    queryFn: () => khataService.getAccounts(),
  })
  const accounts = accountsData?.accounts ?? []

  // Statement (when an account is selected)
  const { data: statementData, isLoading: statementLoading, isFetching: statementFetching } =
    useQuery({
      queryKey: ['khata-statement', selected?.id],
      queryFn: () => khataService.getStatement(selected.id),
      enabled: !!selected?.id,
    })
  const account = statementData?.account ?? null
  const entries = statementData?.entries ?? []

  // Counterparty options for the picker (new pairs + existing accounts merged)
  const { data: pickerSource } = useQuery({
    queryKey: ['khata-counterparties', role],
    queryFn: async () => {
      if (role === 'dealer') {
        const { items } = await dealerAgentService.getAll()
        return items.map((agent) => ({ id: agent.agentId, name: agent.firmName }))
      }
      const rows = await processAssignmentService.listForAgent()
      const seen = new Map()
      rows.forEach((row) => {
        const dealer = row?.process?.dealer
        if (dealer?.dealerId && !seen.has(dealer.dealerId)) {
          seen.set(dealer.dealerId, { id: dealer.dealerId, name: dealer.firmName })
        }
      })
      return Array.from(seen.values())
    },
  })

  const counterpartyOptions = useMemo(() => {
    const map = new Map()
    ;(pickerSource ?? []).forEach((opt) => {
      if (opt.id) map.set(opt.id, { id: opt.id, name: opt.name || counterpartyLabel })
    })
    accounts.forEach((acc) => {
      const id = counterpartyIdOf(acc)
      if (id && !map.has(id)) {
        map.set(id, { id, name: acc.counterparty?.firmName || counterpartyLabel })
      }
    })
    return Array.from(map.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerSource, accounts, role])

  // Mutations
  const postMutation = useMutation({
    mutationFn: khataService.postEntry,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['khata-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['khata-statement', variables.counterpartyId] })
      toast({ title: 'Entry posted', description: 'The ledger entry was recorded.', variant: 'success' })
      setEntryOpen(false)
    },
    onError: (err) => {
      toast({ title: 'Failed to post entry', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const reverseMutation = useMutation({
    mutationFn: (ledgerEntryId) => khataService.reverseEntry(ledgerEntryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['khata-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['khata-statement', selected?.id] })
      toast({ title: 'Entry reversed', description: 'A counter-entry was posted.', variant: 'success' })
      setReverseTarget(null)
    },
    onError: (err) => {
      toast({ title: 'Failed to reverse entry', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const settleMutation = useMutation({
    mutationFn: (counterpartyId) => khataService.settle(counterpartyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['khata-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['khata-statement', selected?.id] })
      toast({ title: 'Account settled', description: 'A balancing entry was posted.', variant: 'success' })
      setSettleOpen(false)
    },
    onError: (err) => {
      toast({ title: 'Failed to settle', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const handlePostEntry = async (values) => {
    await postMutation.mutateAsync(values)
  }

  const columns = useMemo(
    () => [
      {
        key: 'entryDate',
        label: 'Date',
        render: (row) => <span className="whitespace-nowrap">{formatDate(row.entryDate)}</span>,
      },
      {
        key: 'description',
        label: 'Description',
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(row.isReversed && 'line-through text-muted-foreground')}>
              {row.description || '—'}
            </span>
            {row.isReversed && <Badge variant="secondary">Reversed</Badge>}
            {row.reversesEntryId && <Badge variant="outline">Reversal</Badge>}
          </div>
        ),
      },
      {
        key: 'credit',
        label: 'Credit',
        render: (row) =>
          row.direction === 'CREDIT' ? (
            <span className="text-success whitespace-nowrap">{formatMoney(row.amount)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'debit',
        label: 'Debit',
        render: (row) =>
          row.direction === 'DEBIT' ? (
            <span className="text-warning whitespace-nowrap">{formatMoney(row.amount)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'balanceAfter',
        label: 'Balance',
        render: (row) => (
          <span className="font-medium whitespace-nowrap">{formatMoney(row.balanceAfter)}</span>
        ),
      },
      {
        label: 'Actions',
        render: (row) =>
          !row.isReversed && !row.reversesEntryId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReverseTarget(row)}
              aria-label="Reverse entry"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reverse
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    []
  )

  // ---- Statement view ----
  if (selected) {
    const bal = balanceLabel(account?.balance ?? 0, role, selected.name)
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setSelected(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to accounts
        </Button>

        <Card>
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{counterpartyLabel}</p>
              <h1 className="text-2xl font-bold">{selected.name}</h1>
              <p className={cn('mt-1 text-base font-semibold', TONE_TEXT[bal.tone])}>{bal.text}</p>
              <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                <span>Total credit: {formatMoney(account?.totalCredit ?? 0)}</span>
                <span>Total debit: {formatMoney(account?.totalDebit ?? 0)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSettleOpen(true)}>
                <Wallet className="mr-2 h-4 w-4" /> Settle up
              </Button>
              <Button onClick={() => setEntryOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add entry
              </Button>
            </div>
          </CardContent>
        </Card>

        <DataTable
          mode="client"
          columns={columns}
          data={entries}
          isLoading={statementLoading}
          isFetching={statementFetching}
          itemLabel="entries"
          emptyTitle="No entries yet"
          emptyDescription="Post the first credit or debit entry to start the statement."
          showExport={false}
          selectable={false}
          getRowId={(row) => row.ledgerEntryId}
        />

        <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add ledger entry</DialogTitle>
              <DialogDescription>
                Record a credit or debit against {selected.name}.
              </DialogDescription>
            </DialogHeader>
            <EntryForm
              counterpartyLabel={counterpartyLabel}
              counterpartyOptions={counterpartyOptions}
              lockedCounterparty={selected}
              onSubmit={handlePostEntry}
              loading={postMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        <ConfirmModal
          open={!!reverseTarget}
          onOpenChange={() => setReverseTarget(null)}
          title="Reverse entry"
          description={`Reverse this ${reverseTarget?.direction === 'CREDIT' ? 'credit' : 'debit'} of ${formatMoney(reverseTarget?.amount ?? 0)}? A counter-entry will be posted; the original is kept for audit.`}
          confirmLabel="Reverse"
          variant="destructive"
          onConfirm={() => reverseMutation.mutate(reverseTarget.ledgerEntryId)}
          loading={reverseMutation.isPending}
        />

        <ConfirmModal
          open={settleOpen}
          onOpenChange={setSettleOpen}
          title="Settle up"
          description={`Post a balancing entry to settle the account with ${selected.name} in full?`}
          confirmLabel="Settle up"
          onConfirm={() => settleMutation.mutate(selected.id)}
          loading={settleMutation.isPending}
        />
      </div>
    )
  }

  // ---- Accounts list view ----
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Ledger</h1>
          <p className="mt-1 text-muted-foreground">
            Khata book of money between you and your {counterpartyLabel.toLowerCase()}s
          </p>
        </div>
        <Button onClick={() => setEntryOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add entry
        </Button>
      </motion.div>

      {accountsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-4 w-28 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description={`Post an entry against an ${counterpartyLabel.toLowerCase()} to open a khata account.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accounts.map((acc) => {
            const id = counterpartyIdOf(acc)
            const name = acc.counterparty?.firmName || counterpartyLabel
            const subtitle =
              role === 'dealer' ? acc.counterparty?.agentName : acc.counterparty?.dealerName
            const bal = balanceLabel(acc.balance, role, name)
            return (
              <button
                key={acc.khataAccountId ?? id}
                type="button"
                onClick={() => setSelected({ id, name })}
                className="text-left"
              >
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-bg">
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{name}</p>
                      {subtitle && (
                        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                      )}
                    </div>
                    <Badge variant={TONE_BADGE[bal.tone]} className="shrink-0 normal-case">
                      {bal.text}
                    </Badge>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add ledger entry</DialogTitle>
            <DialogDescription>
              Pick an {counterpartyLabel.toLowerCase()} and record a credit or debit.
            </DialogDescription>
          </DialogHeader>
          <EntryForm
            counterpartyLabel={counterpartyLabel}
            counterpartyOptions={counterpartyOptions}
            lockedCounterparty={null}
            onSubmit={handlePostEntry}
            loading={postMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
