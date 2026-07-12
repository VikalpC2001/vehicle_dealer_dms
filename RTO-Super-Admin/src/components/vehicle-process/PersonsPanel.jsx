import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Pencil, Trash2, User, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { PersonFormDialog } from './PersonFormDialog'
import { personService } from '@/services/personService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

function getPersonId(person) {
  return person?.personId ?? person?.id
}

function toFormValues(person) {
  return {
    personName: person.personName,
    mobileNumber: person.mobileNumber,
    address: person.address ?? '',
    personType: person.personType,
  }
}

const DIALOG_TITLES = {
  addSeller: 'Add Seller',
  editSeller: 'Edit Seller',
  addBuyer: 'Add Buyer',
  editBuyer: 'Edit Buyer',
}

/**
 * Seller (single, edit-only) and Buyer (add/edit/delete) shown as two separate cards.
 * Self-contained: owns the persons query + mutations and refreshes the process detail.
 *
 * @param {object} props
 * @param {string} props.processId
 */
export function PersonsPanel({ processId }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState(null) // { mode, person? }
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ['persons', processId],
    queryFn: () => personService.getByProcess(processId),
    enabled: Boolean(processId),
  })

  const seller = persons.find((p) => p.personType === 'SELLER')
  const buyers = persons.filter((p) => p.personType === 'BUYER')

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['persons', processId] })
    queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId, 'details'] })
    // Refresh the getById-backed Deal card so its price inputs re-gate on the new counterparty.
    queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId] })
  }

  const createMutation = useMutation({
    mutationFn: (values) => personService.create({ ...values, processId }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Saved', variant: 'success' })
      setDialog(null)
    },
    onError: (err) => toast({ title: 'Failed to save', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => personService.update(id, values),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Saved', variant: 'success' })
      setDialog(null)
    },
    onError: (err) => toast({ title: 'Failed to save', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => personService.remove(id),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Buyer removed', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Failed to remove', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const isEdit = dialog?.mode === 'editSeller' || dialog?.mode === 'editBuyer'
  const dialogType = dialog?.mode === 'addSeller' || dialog?.mode === 'editSeller' ? 'SELLER' : 'BUYER'
  const handleSubmit = (values) =>
    isEdit
      ? updateMutation.mutateAsync({ id: getPersonId(dialog.person), values })
      : createMutation.mutateAsync(values)

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Seller card — single, edit only */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" /> Seller / Owner
          </CardTitle>
          {seller ? (
            <Button variant="outline" size="sm" onClick={() => setDialog({ mode: 'editSeller', person: seller })}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          ) : (
            <Button size="sm" onClick={() => setDialog({ mode: 'addSeller' })}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Add Seller
            </Button>
          )}
        </CardHeader>
        <CardContent className="text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : seller ? (
            <div className="space-y-1">
              <p className="font-medium">{seller.personName}</p>
              {seller.mobileNumber && <p className="text-muted-foreground">{seller.mobileNumber}</p>}
              {seller.address && <p className="text-muted-foreground">{seller.address}</p>}
            </div>
          ) : (
            <p className="text-muted-foreground">No seller recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Buyer card — add/edit/delete */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" /> Buyer
          </CardTitle>
          <Button size="sm" onClick={() => setDialog({ mode: 'addBuyer' })}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Add Buyer
          </Button>
        </CardHeader>
        <CardContent className="text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : buyers.length === 0 ? (
            <p className="text-muted-foreground">No buyer recorded yet. Add one when the vehicle is sold.</p>
          ) : (
            <div className="divide-y divide-border">
              {buyers.map((buyer) => (
                <div key={getPersonId(buyer)} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium">{buyer.personName}</p>
                    {buyer.mobileNumber && <p className="text-muted-foreground">{buyer.mobileNumber}</p>}
                    {buyer.address && <p className="truncate text-muted-foreground">{buyer.address}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDialog({ mode: 'editBuyer', person: buyer })} aria-label="Edit buyer">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(buyer)} aria-label="Remove buyer">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PersonFormDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog ? DIALOG_TITLES[dialog.mode] : ''}
        lockType
        defaultValues={
          dialog?.person ? toFormValues(dialog.person) : { personType: dialogType }
        }
        onSubmit={handleSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
        submitLabel={isEdit ? 'Save Changes' : 'Add'}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Remove buyer"
        description={`Remove ${deleteTarget?.personName ?? 'this buyer'} from the process?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getPersonId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
