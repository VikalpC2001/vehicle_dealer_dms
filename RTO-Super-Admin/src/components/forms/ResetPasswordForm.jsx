import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { authService } from '@/services/authService'
import { usePasswordReset } from '@/context/PasswordResetContext'
import { getPasswordStrength } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const { resetToken, clearResetFlow } = usePasswordReset()

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = watch('password', '')
  const strength = getPasswordStrength(password)

  const onSubmit = async ({ password: newPassword }) => {
    setLoading(true)
    try {
      const result = await authService.resetPassword(newPassword, resetToken)
      clearResetFlow()
      setSuccess(true)
      toast({ title: 'Password reset', description: result.message, variant: 'success' })
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      const status = err?.response?.status
      const message = authService.getErrorMessage(err, 'Unable to reset password.')

      toast({ title: 'Reset failed', description: message, variant: 'destructive' })

      if (status === 401) {
        clearResetFlow()
        setTimeout(() => navigate('/forgot-password'), 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md text-center"
      >
        <CheckCircle2 className="mx-auto h-16 w-16 text-success mb-4" />
        <h2 className="text-2xl font-bold">Password updated</h2>
        <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
      </motion.div>
    )
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
          <KeyRound className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold">Set new password</h2>
        <p className="mt-2 text-muted-foreground">
          Choose a strong password with at least 8 characters.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="space-y-1">
              <Progress value={strength.score * 25} className="h-1.5" />
              <p className="text-xs text-muted-foreground">Strength: {strength.label}</p>
            </div>
          )}
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm new password"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</> : 'Reset Password'}
        </Button>
      </form>
    </motion.div>
  )
}
