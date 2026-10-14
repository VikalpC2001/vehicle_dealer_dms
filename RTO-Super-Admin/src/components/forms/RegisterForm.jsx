import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Store, UserCog, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EmailOtpStep } from '@/components/forms/EmailOtpStep'
import { useAuth } from '@/context/AuthContext'
import { registrationService } from '@/services/registrationService'
import { getErrorMessage, getErrorCode } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'
import { cn, getPasswordStrength } from '@/lib/utils'
import { homeForRole } from '@/lib/constants'

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email'),
    mobile: z.string().min(7, 'Please enter a valid mobile number'),
    companyName: z.string().min(2, 'Company / firm name is required'),
    role: z.enum(['dealer', 'agent'], { required_error: 'Please select a role' }),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/** The two account types, shown as selectable cards. */
const ROLE_OPTIONS = [
  { value: 'dealer', label: 'Dealer', hint: 'Buy and sell vehicles', icon: Store },
  { value: 'agent', label: 'RTO Agent', hint: 'Handle RTO work', icon: UserCog },
]

/** Marks a field invalid for assistive tech; the `Input` primitive turns that into a red border. */
const invalid = (error) => (error ? true : undefined)

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [step, setStep] = useState('details') // 'details' | 'otp'
  const [email, setEmail] = useState('')
  const [accountExists, setAccountExists] = useState(false)
  const { applySession } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, watch, trigger, formState: { errors, isSubmitting, isSubmitted } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'dealer' },
  })

  const password = watch('password', '')
  const strength = getPasswordStrength(password)
  const role = watch('role')

  // "Passwords do not match" belongs to the confirm field, so once the form has been submitted
  // re-check it whenever the password changes — otherwise fixing the password would leave a stale
  // red border on the confirm field.
  useEffect(() => {
    if (isSubmitted) trigger('confirmPassword')
  }, [password, isSubmitted, trigger])

  const onSubmit = async (data) => {
    setAccountExists(false)
    try {
      await registrationService.selfRegister({
        registerAs: data.role.toUpperCase(),
        applicantName: data.fullName,
        firmName: data.companyName,
        emailId: data.email,
        mobileNo: data.mobile,
        password: data.password,
      })
      setEmail(data.email)
      setStep('otp')
      toast({ title: 'Verify your email', description: 'We sent a 6-digit code to your email.', variant: 'success' })
    } catch (err) {
      // A verified account already uses this email → point them to sign-in.
      if (getErrorCode(err) === 4091) setAccountExists(true)
      toast({ title: 'Registration failed', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  // After email verification: sign in, then route to the dashboard (approved) or pending screen.
  const handleVerified = (raw) => {
    const session = applySession(raw)
    const approved = session.user?.approvalStatus === 'APPROVED'
    toast({
      title: 'Email verified',
      description: approved ? 'Welcome aboard!' : 'Your account is now pending admin approval.',
      variant: 'success',
    })
    navigate(approved ? homeForRole(session.user?.role) : '/pending-approval', { replace: true })
  }

  if (step === 'otp') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <EmailOtpStep email={email} onVerified={handleVerified} onBack={() => setStep('details')} />
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-0 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Register as a Dealer or Agent — reviewed by our team before access.</CardDescription>
        </CardHeader>
        <CardContent>
          {accountExists && (
            <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              This email is already registered.{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">Sign in instead</Link>.
            </div>
          )}
          {/* noValidate: the browser's own email check would block the submit with its native bubble,
              so the form's messages and red borders would never show for a badly formed email.
              Browser suggestions are switched off as far as a page can: autoComplete="off" here and
              on each text field stops previously-typed values and type-ahead suggestions, and
              writingsuggestions (inherited by every input) stops inline text prediction. Browsers
              ignore "off" for their saved-address and password features by design, so those can
              still appear; the password fields use "new-password" so a saved login is never filled
              into a new account. Do not swap in made-up tokens — they turn form history back on. */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            autoComplete="off"
            writingsuggestions="false"
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label id="register-as-label">I want to register as</Label>
              <div role="radiogroup" aria-labelledby="register-as-label" className="grid grid-cols-2 gap-3">
                {ROLE_OPTIONS.map((option) => {
                  const selected = role === option.value
                  const Icon = option.icon
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'relative flex cursor-pointer flex-col items-start gap-3 rounded-xl border-2 p-4 transition-colors sm:flex-row sm:items-center',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
                      )}
                    >
                      {/* Covers the whole card (invisible) rather than sr-only: a 1px hidden radio that is
                          scrolled off-screen makes the page jump when a click focuses it. */}
                      <input
                        type="radio"
                        value={option.value}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        {...register('role')}
                      />
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                          selected ? 'gradient-bg text-white' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className={cn('block text-sm font-semibold', selected && 'text-primary')}>{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.hint}</span>
                      </span>
                      {selected && <CheckCircle2 className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-primary" aria-hidden="true" />}
                    </label>
                  )
                })}
              </div>
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="John Doe" autoComplete="off" autoCorrect="off" spellCheck={false} aria-invalid={invalid(errors.fullName)} {...register('fullName')} />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Company / Firm Name</Label>
                <Input placeholder="Your Company" autoComplete="off" autoCorrect="off" spellCheck={false} aria-invalid={invalid(errors.companyName)} {...register('companyName')} />
                {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="john@company.com" autoComplete="off" spellCheck={false} aria-invalid={invalid(errors.email)} {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input placeholder="+91 98765 43210" inputMode="tel" autoComplete="off" autoCorrect="off" spellCheck={false} aria-invalid={invalid(errors.mobile)} {...register('mobile')} />
                {errors.mobile && <p className="text-sm text-destructive">{errors.mobile.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pr-10 [&::-ms-reveal]:hidden"
                    aria-invalid={invalid(errors.password)}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1">
                    <Progress value={strength.percent} className="h-1.5" indicatorClassName={strength.color} />
                    <p className="text-xs text-muted-foreground">
                      Strength: <span className={`font-medium ${strength.textColor}`}>{strength.label}</span>
                    </p>
                  </div>
                )}
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pr-10 [&::-ms-reveal]:hidden"
                    aria-invalid={invalid(errors.confirmPassword)}
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : 'Create Account'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
