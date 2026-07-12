import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authService } from '@/services/authService'
import { usePasswordReset } from '@/context/PasswordResetContext'
import { toast } from '@/hooks/use-toast'

const schema = z.object({
  otp: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must contain only digits'),
})

export function VerifyOtpForm() {
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const navigate = useNavigate()
  const { email, setResetToken } = usePasswordReset()

  const { handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { otp: '' },
  })

  const otp = watch('otp')

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setValue('otp', value, { shouldValidate: value.length === 6, shouldDirty: true })
  }

  const onSubmit = async ({ otp: code }) => {
    setLoading(true)
    try {
      const result = await authService.verifyOtp({ email, otp: code })
      setResetToken(result.resetToken)
      toast({ title: 'Code verified', description: result.message, variant: 'success' })
      navigate('/forgot-password/reset')
    } catch (err) {
      toast({
        title: 'Verification failed',
        description: authService.getErrorMessage(err, 'Invalid or expired reset code'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const result = await authService.resendOtp({ email })
      toast({ title: 'Code sent', description: result.message, variant: 'success' })
    } catch (err) {
      toast({
        title: 'Resend failed',
        description: authService.getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-md"
    >
      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-bg">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold">Enter reset code</h2>
        <p className="mt-2 text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="otp">6-digit code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            className="text-center text-2xl tracking-[0.5em] font-bold"
            onChange={handleOtpChange}
            value={otp}
          />
          {errors.otp && <p className="text-sm text-destructive">{errors.otp.message}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading || otp.length !== 6}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : 'Verify Code'}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-primary hover:underline cursor-pointer disabled:opacity-50"
          >
            {resending ? 'Sending...' : "Didn't receive a code? Resend"}
          </button>
        </div>

        <Button variant="ghost" className="w-full" asChild>
          <Link to="/forgot-password"><ArrowLeft className="mr-2 h-4 w-4" /> Change email</Link>
        </Button>
      </form>
    </motion.div>
  )
}
