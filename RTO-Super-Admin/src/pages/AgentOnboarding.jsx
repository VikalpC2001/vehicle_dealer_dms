import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Shield, Loader2, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StateCitySelect } from '@/components/common/StateCitySelect'
import { agentInvitationService } from '@/services/agentInvitationService'
import { useAuth } from '@/context/AuthContext'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'
import { APP_NAME } from '@/lib/constants'

const onboardingSchema = z
  .object({
    firmName: z.string().min(2, 'Firm name is required'),
    agentName: z.string().min(2, 'Your name is required'),
    displayName: z.string().min(2, 'Display name is required'),
    mobileNo: z.string().min(7, 'Enter a valid mobile number'),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    whatsappNo: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/** Branded auth-style shell (module-level so children don't remount on each keystroke). */
function OnboardingShell({ children }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <div className="inline-flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-bg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">{APP_NAME}</span>
        </div>
      </motion.div>
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  )
}

/**
 * Public agent onboarding page (`/agent-onboarding/:token`). Validates the invitation token,
 * prefills the invited details, and on submit creates the agent account + login (auto-granting to
 * the inviting dealer when a slot is free), then logs the new agent straight in.
 */
export default function AgentOnboarding() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { applySession } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: prefill, isLoading, isError, error } = useQuery({
    queryKey: ['agent-invite-prefill', token],
    queryFn: () => agentInvitationService.getAcceptPrefill(token),
    enabled: !!token,
    retry: false,
  })

  // RHF `values` re-seeds the form when the async prefill arrives — no reset-in-render side effect.
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(onboardingSchema),
    values: prefill
      ? {
          firmName: '',
          agentName: prefill.agentName ?? '',
          displayName: prefill.agentName ?? '',
          mobileNo: prefill.mobileNo ?? '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          whatsappNo: '',
          password: '',
          confirmPassword: '',
        }
      : undefined,
  })

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      const { confirmPassword, ...payload } = values
      void confirmPassword
      const result = await agentInvitationService.accept(token, payload)
      applySession(result)
      toast({
        title: 'Welcome aboard!',
        description: result?.granted
          ? 'Your agent account is ready and linked to your dealer.'
          : 'Your agent account is ready. Your dealer will activate you shortly.',
        variant: 'success',
      })
      navigate('/agent/dashboard', { replace: true })
    } catch (err) {
      toast({ title: 'Could not complete onboarding', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <OnboardingShell>
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Validating your invitation…
        </div>
      </OnboardingShell>
    )
  }

  if (isError) {
    return (
      <OnboardingShell>
        <Card className="border-0 shadow-xl">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto h-14 w-14 text-warning" />
            <h2 className="mt-4 text-2xl font-bold">Invitation unavailable</h2>
            <p className="mt-2 text-muted-foreground">{getErrorMessage(error)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask your dealer to send you a fresh invitation link.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/login">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <CardTitle className="text-2xl">Join {prefill?.dealerName}</CardTitle>
            <CardDescription>
              You've been invited to onboard as an RTO agent. Complete your profile to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Invited email</Label>
                <Input value={prefill?.emailId ?? ''} disabled readOnly />
                <p className="text-xs text-muted-foreground">Your login email — set from your invitation.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Firm / Agency Name</Label>
                  <Input placeholder="Your agency" {...register('firmName')} />
                  {errors.firmName && <p className="text-sm text-destructive">{errors.firmName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Your Name</Label>
                  <Input {...register('agentName')} />
                  {errors.agentName && <p className="text-sm text-destructive">{errors.agentName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input {...register('displayName')} />
                  {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input {...register('mobileNo')} />
                  {errors.mobileNo && <p className="text-sm text-destructive">{errors.mobileNo.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp Number (optional)</Label>
                  <Input {...register('whatsappNo')} />
                </div>
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

                <div className="space-y-2">
                  <Label>Pincode (optional)</Label>
                  <Input {...register('pincode')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address (optional)</Label>
                <Input {...register('address')} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} placeholder="Create password" {...register('password')} />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" placeholder="Confirm password" {...register('confirmPassword')} />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating your account…
                  </>
                ) : (
                  'Complete onboarding'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </OnboardingShell>
  )
}
