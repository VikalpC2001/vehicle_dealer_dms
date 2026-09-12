import { useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { StateCitySelect } from '@/components/common/StateCitySelect'
import { dealerService } from '@/services/dealerService'
import { dealerSchema, defaultDealerValues } from '@/components/forms/DealerForm'
import { parseValidationErrors, getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/** Editable profile fields (everything except isSubscribe, which is super-admin's). */
function mapDealer(d) {
  return {
    firmName: d.firmName ?? '',
    dealerName: d.dealerName ?? '',
    displayName: d.displayName ?? '',
    emailId: d.emailId ?? '',
    mobileNo: d.mobileNo ?? '',
    whatsappNo: d.whatsappNo ?? '',
    address: d.address ?? '',
    city: d.city ?? '',
    state: d.state ?? '',
    pincode: d.pincode ?? '',
  }
}

/**
 * Loads the logged-in dealer and renders the profile form ONLY once the data is present, so the
 * form's `useForm` initializes with the real values (a form created before the data arrives — e.g.
 * on a full page reload — left the Controller-bound state/city dropdowns blank).
 */
export function DealerProfilePanel() {
  const { user } = useAuth()
  const dealerId = user?.dealerId

  const { data: dealer, isLoading } = useQuery({
    queryKey: ['dealer', dealerId],
    queryFn: () => dealerService.getById(dealerId),
    enabled: Boolean(dealerId),
  })

  if (!dealerId) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No dealer profile is linked to your account.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Firm Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !dealer ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <DealerProfileForm dealer={dealer} dealerId={dealerId} />
        )}
      </CardContent>
    </Card>
  )
}

/** The actual form — mounts only when `dealer` is available, so `useForm` seeds all fields (incl. the controlled state/city). */
function DealerProfileForm({ dealer, dealerId }) {
  const queryClient = useQueryClient()

  const formValues = useMemo(() => ({ ...defaultDealerValues, ...mapDealer(dealer) }), [dealer])

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(dealerSchema), values: formValues })

  const updateMutation = useMutation({
    mutationFn: (values) =>
      dealerService.update(dealerId, { ...values, isSubscribe: Boolean(dealer?.isSubscribe) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer', dealerId] })
      toast({ title: 'Profile updated', variant: 'success' })
    },
    onError: (err) => {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
      toast({ title: 'Could not update profile', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  return (
    <form onSubmit={handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Firm Name" id="firmName" error={errors.firmName?.message}>
          <Input id="firmName" {...register('firmName')} />
        </Field>
        <Field label="Dealer Name" id="dealerName" error={errors.dealerName?.message}>
          <Input id="dealerName" {...register('dealerName')} />
        </Field>
        <Field label="Display Name" id="displayName" error={errors.displayName?.message}>
          <Input id="displayName" {...register('displayName')} />
        </Field>
        <Field label="Email" id="emailId" error={errors.emailId?.message}>
          <Input id="emailId" type="email" {...register('emailId')} />
        </Field>
        <Field label="Mobile Number" id="mobileNo" error={errors.mobileNo?.message}>
          <Input id="mobileNo" maxLength={10} {...register('mobileNo')} />
        </Field>
        <Field label="WhatsApp Number" id="whatsappNo" error={errors.whatsappNo?.message}>
          <Input id="whatsappNo" maxLength={10} {...register('whatsappNo')} />
        </Field>
      </div>

      <Field label="Address" id="address" error={errors.address?.message}>
        <Input id="address" {...register('address')} />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Controller
          control={control}
          name="state"
          render={({ field: stateField }) => (
            <Controller
              control={control}
              name="city"
              render={({ field: cityField }) => (
                <StateCitySelect
                  stateValue={stateField.value || ''}
                  cityValue={cityField.value || ''}
                  onStateChange={stateField.onChange}
                  onCityChange={cityField.onChange}
                  stateError={errors.state?.message}
                  cityError={errors.city?.message}
                />
              )}
            />
          )}
        />
        <Field label="Pincode" id="pincode" error={errors.pincode?.message}>
          <Input id="pincode" maxLength={6} {...register('pincode')} />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Save Profile'}
        </Button>
      </div>
    </form>
  )
}

function Field({ label, id, error, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
