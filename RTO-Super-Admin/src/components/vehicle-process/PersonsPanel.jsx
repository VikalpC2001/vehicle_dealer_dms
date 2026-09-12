import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Pencil, User, Users, RefreshCw, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PersonFormDialog } from './PersonFormDialog'
import { ChangeBuyerDialog } from './ChangeBuyerDialog'
import { PreviousBuyerDialog } from './PreviousBuyerDialog'
import { DocumentPreviewDialog } from './DocumentPreviewDialog'
import { personService } from '@/services/personService'
import { getErrorMessage } from '@/lib/authErrors'
import { cn } from '@/lib/utils'
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
 * Seller (single, edit-only) and Buyer management. Exactly one ACTIVE buyer is allowed; to replace
 * them use "Change Buyer" (the current buyer is CANCELLED — kept for history with their ID photo —
 * and a new buyer is added). Cancelled buyers show below with a badge and their (greyed) ID.
 *
 * @param {object} props
 * @param {string} props.processId
 * @param {string} [props.dealerId] - Managed dealer scope when an agent edits a placeholder's process.
 * @param {boolean} [props.stacked] - Render Seller then Buyer stacked one-per-row (a list) instead of
 *   the default side-by-side two-column grid.
 */
export function PersonsPanel({ processId, dealerId, stacked = false }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState(null) // { mode, person? }
  const [personNonce, setPersonNonce] = useState(0) // bumped per open → remounts PersonFormDialog fresh
  const [changeOpen, setChangeOpen] = useState(false)
  const [changeNonce, setChangeNonce] = useState(0) // bumped per open → remounts ChangeBuyerDialog fresh
  const [viewBuyer, setViewBuyer] = useState(null) // a cancelled buyer whose details modal is open
  const [preview, setPreview] = useState(null) // { url, label }

  const openChangeBuyer = () => {
    setChangeNonce((n) => n + 1)
    setChangeOpen(true)
  }

  // Open the add/edit person dialog, remounting it fresh (resets its ID upload state).
  const openDialog = (next) => {
    setPersonNonce((n) => n + 1)
    setDialog(next)
  }

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ['persons', processId],
    queryFn: () => personService.getByProcess(processId, dealerId),
    enabled: Boolean(processId),
  })

  const seller = persons.find((p) => p.personType === 'SELLER' && p.status !== 'CANCELLED')
  const activeBuyer = persons.find((p) => p.personType === 'BUYER' && p.status === 'ACTIVE')
  const cancelledBuyers = persons.filter((p) => p.personType === 'BUYER' && p.status === 'CANCELLED')

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['persons', processId] })
    // Refresh the getById-backed detail + Deal card so prices re-gate on the new counterparty
    // (['vehicle-process', processId] prefix-matches the '…details' key too).
    queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId] })
    // Process-list views render persons (parties count / seller name) from their own cached rows,
    // which include CANCELLED buyers — refresh them so the count/name reflect the change.
    queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
  }

  const createMutation = useMutation({
    mutationFn: (values) => personService.create({ ...values, processId }, dealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Saved', variant: 'success' })
      setDialog(null)
    },
    onError: (err) => toast({ title: 'Failed to save', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => personService.update(id, values, dealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Saved', variant: 'success' })
      setDialog(null)
    },
    onError: (err) => toast({ title: 'Failed to save', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const changeBuyerMutation = useMutation({
    mutationFn: (values) => personService.changeBuyer({ ...values, processId }, dealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Buyer changed', description: 'The previous buyer was cancelled and kept for history.', variant: 'success' })
      setChangeOpen(false)
    },
    onError: (err) => toast({ title: 'Could not change buyer', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const isEdit = dialog?.mode === 'editSeller' || dialog?.mode === 'editBuyer'
  const dialogType = dialog?.mode === 'addSeller' || dialog?.mode === 'editSeller' ? 'SELLER' : 'BUYER'
  const handleSubmit = (values) =>
    isEdit
      ? updateMutation.mutateAsync({ id: getPersonId(dialog.person), values })
      : createMutation.mutateAsync(values)

  return (
    <div className={cn('grid grid-cols-1 gap-6', !stacked && 'md:grid-cols-2')}>
      {/* Seller card — single, edit only */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" /> Seller / Owner
          </CardTitle>
          {seller ? (
            <Button variant="outline" size="sm" onClick={() => openDialog({ mode: 'editSeller', person: seller })}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          ) : (
            <Button size="sm" onClick={() => openDialog({ mode: 'addSeller' })}>
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

      {/* Buyer card — single active buyer; change = cancel + add; cancelled buyers kept below */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" /> Buyer
          </CardTitle>
          {activeBuyer ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => openDialog({ mode: 'editBuyer', person: activeBuyer })} aria-label="Edit buyer">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={openChangeBuyer}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Change Buyer
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => openDialog({ mode: 'addBuyer' })}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Add Buyer
            </Button>
          )}
        </CardHeader>
        <CardContent className="text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              {activeBuyer ? (
                <div>
                  <p className="font-medium">{activeBuyer.personName}</p>
                  {activeBuyer.mobileNumber && <p className="text-muted-foreground">{activeBuyer.mobileNumber}</p>}
                  {activeBuyer.address && <p className="truncate text-muted-foreground">{activeBuyer.address}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">No buyer recorded yet. Add one when the vehicle is sold.</p>
              )}

              {cancelledBuyers.length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Previous buyers</p>
                  {cancelledBuyers.map((buyer) => (
                    <div key={getPersonId(buyer)} className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium line-through decoration-muted-foreground/50">
                          {buyer.personName}
                        </p>
                        <Badge variant="outline" className="shrink-0 border-destructive/20 bg-destructive/10 text-destructive">
                          Cancelled
                        </Badge>
                        {buyer.idPhotos?.length > 0 && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {buyer.idPhotos.length} doc{buyer.idPhotos.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setViewBuyer(buyer)}>
                        <Eye className="mr-1.5 h-4 w-4" /> View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PersonFormDialog
        key={personNonce}
        open={Boolean(dialog)}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog ? DIALOG_TITLES[dialog.mode] : ''}
        lockType
        defaultValues={dialog?.person ? toFormValues(dialog.person) : { personType: dialogType }}
        onSubmit={handleSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
        submitLabel={isEdit ? 'Save Changes' : 'Add'}
      />

      <ChangeBuyerDialog
        key={changeNonce}
        open={changeOpen}
        onOpenChange={setChangeOpen}
        onSubmit={(values) => changeBuyerMutation.mutate(values)}
        loading={changeBuyerMutation.isPending}
      />

      <PreviousBuyerDialog
        open={Boolean(viewBuyer)}
        onOpenChange={(o) => !o && setViewBuyer(null)}
        buyer={viewBuyer}
        onPreview={setPreview}
      />

      <DocumentPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        url={preview?.url}
        label={preview?.label}
      />
    </div>
  )
}
