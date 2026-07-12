import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { parseValidationErrors } from '@/lib/authErrors'

const optionalPincode = z.string().refine((val) => val === '' || /^\d{6}$/.test(val), {
  message: 'Pincode must be 6 digits',
})
const optionalMobile = z.string().refine((val) => val === '' || /^\d{10}$/.test(val), {
  message: 'Mobile number must be 10 digits',
})
const optionalEmail = z.string().refine((val) => val === '' || z.string().email().safeParse(val).success, {
  message: 'Please enter a valid email',
})

export const agentSchema = z.object({
  firmName: z.string().min(2, 'Firm name is required'),
  agentName: z.string().min(2, 'Agent name is required'),
  displayName: z.string().min(2, 'Display name is required'),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  pincode: optionalPincode,
  mobileNo: optionalMobile,
  emailId: optionalEmail,
  whatsappNo: optionalMobile,
  isSubscribe: z.boolean(),
})

export const defaultAgentValues = {
  firmName: '',
  agentName: '',
  displayName: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  mobileNo: '',
  emailId: '',
  whatsappNo: '',
  isSubscribe: false,
}

/**
 * @param {object} props
 * @param {import('react-hook-form').DefaultValues<z.infer<typeof agentSchema>>} [props.defaultValues]
 * @param {(values: z.infer<typeof agentSchema>) => void | Promise<void>} props.onSubmit
 * @param {boolean} [props.loading]
 * @param {string} [props.submitLabel]
 */
export function AgentForm({ defaultValues, onSubmit, loading, submitLabel = 'Save Agent' }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(agentSchema),
    defaultValues: { ...defaultAgentValues, ...defaultValues },
  })

  const isSubscribe = watch('isSubscribe')

  useEffect(() => {
    reset({ ...defaultAgentValues, ...defaultValues })
  }, [defaultValues, reset])

  const handleFormSubmit = async (values) => {
    try {
      await onSubmit(values)
    } catch (err) {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => {
        setError(field, { message })
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Firm Name" id="firmName" error={errors.firmName?.message}>
          <Input id="firmName" placeholder="ABC RTO Services" {...register('firmName')} />
        </Field>
        <Field label="Agent Name" id="agentName" error={errors.agentName?.message}>
          <Input id="agentName" placeholder="John Agent" {...register('agentName')} />
        </Field>
        <Field label="Display Name" id="displayName" error={errors.displayName?.message}>
          <Input id="displayName" placeholder="ABC RTO Services" {...register('displayName')} />
        </Field>
        <Field label="Email" id="emailId" error={errors.emailId?.message}>
          <Input id="emailId" type="email" placeholder="agent@example.com" {...register('emailId')} />
        </Field>
        <Field label="Mobile Number" id="mobileNo" error={errors.mobileNo?.message}>
          <Input id="mobileNo" placeholder="9876543210" maxLength={10} {...register('mobileNo')} />
        </Field>
        <Field label="WhatsApp Number" id="whatsappNo" error={errors.whatsappNo?.message}>
          <Input id="whatsappNo" placeholder="9876543210" maxLength={10} {...register('whatsappNo')} />
        </Field>
      </div>

      <Field label="Address" id="address" error={errors.address?.message}>
        <Input id="address" placeholder="123 Main St" {...register('address')} />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="City" id="city" error={errors.city?.message}>
          <Input id="city" placeholder="Mumbai" {...register('city')} />
        </Field>
        <Field label="State" id="state" error={errors.state?.message}>
          <Input id="state" placeholder="Maharashtra" {...register('state')} />
        </Field>
        <Field label="Pincode" id="pincode" error={errors.pincode?.message}>
          <Input id="pincode" placeholder="400001" maxLength={6} {...register('pincode')} />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
        <div>
          <p className="text-sm font-medium">Subscription Active</p>
          <p className="text-xs text-muted-foreground">Enable agent subscription status</p>
        </div>
        <Switch checked={isSubscribe} onCheckedChange={(v) => setValue('isSubscribe', v)} />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : submitLabel}
      </Button>
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
