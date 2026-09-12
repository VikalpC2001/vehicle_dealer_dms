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
import { agentService } from '@/services/agentService'
import { agentSchema } from '@/components/forms/AgentForm'
import { parseValidationErrors, getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/** Profile form = the agent fields minus `isSubscribe` (super-admin's; never edited here). */
const agentProfileSchema = agentSchema.omit({ isSubscribe: true })

/**
 * Optional + unique fields that must be OMITTED when blank rather than sent as "". The server
 * validates `emailId` as an email (so "" → 422) and treats a stored "" mobile/whatsapp as a real
 * value that can collide on the unique index. Omitting a blank field leaves the stored value
 * untouched (an agent with no email can still save other edits).
 */
const OMIT_IF_BLANK = ['emailId', 'mobileNo', 'whatsappNo']

/** Drops blank optional-unique fields from the payload before PATCH /agents/me. */
function toPayload(values) {
  const out = { ...values }
  for (const key of OMIT_IF_BLANK) {
    if (!out[key] || String(out[key]).trim() === '') delete out[key]
  }
  return out
}

/** Maps a fetched agent to the editable form fields (all strings). */
function mapAgent(a = {}) {
  return {
    firmName: a.firmName ?? '',
    agentName: a.agentName ?? '',
    displayName: a.displayName ?? '',
    emailId: a.emailId ?? '',
    mobileNo: a.mobileNo ?? '',
    whatsappNo: a.whatsappNo ?? '',
    address: a.address ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    pincode: a.pincode ?? '',
  }
}

/**
 * Loads the logged-in agent (`GET /agents/me`) and renders the profile form only once the data is
 * present, so `useForm` initializes with the real values (a form created before the data arrives —
 * e.g. on a full page reload — left the Controller-bound state/city dropdowns blank).
 */
export function AgentProfilePanel() {
  const { user } = useAuth()
  const agentId = user?.agentId

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', 'me'],
    queryFn: () => agentService.getMe(),
    enabled: Boolean(agentId),
  })

  if (!agentId) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No agent profile is linked to your account.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !agent ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <AgentProfileForm agent={agent} />
        )}
      </CardContent>
    </Card>
  )
}

/** The actual form — mounts only when `agent` is available, so `useForm` seeds all fields (incl. controlled state/city). */
function AgentProfileForm({ agent }) {
  const queryClient = useQueryClient()

  const formValues = useMemo(() => mapAgent(agent), [agent])

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(agentProfileSchema), values: formValues })

  const updateMutation = useMutation({
    mutationFn: (values) => agentService.updateMe(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', 'me'] })
      toast({ title: 'Profile updated', variant: 'success' })
    },
    onError: (err) => {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
      toast({ title: 'Could not update profile', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  return (
    <form onSubmit={handleSubmit((v) => updateMutation.mutate(toPayload(v)))} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Firm Name" id="firmName" error={errors.firmName?.message}>
          <Input id="firmName" {...register('firmName')} />
        </Field>
        <Field label="Agent Name" id="agentName" error={errors.agentName?.message}>
          <Input id="agentName" {...register('agentName')} />
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
          {updateMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            'Save Profile'
          )}
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
