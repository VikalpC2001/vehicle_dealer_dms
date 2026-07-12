import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authService } from '@/services/authService'
import { usePasswordReset } from '@/context/PasswordResetContext'
import { toast } from '@/hooks/use-toast'

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
})

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setEmail } = usePasswordReset()

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = async ({ email }) => {
    setLoading(true)
    try {
      const result = await authService.forgotPassword(email)
      setEmail(email)
      toast({ title: 'Check your email', description: result.message, variant: 'success' })
      navigate('/forgot-password/verify-otp')
    } catch (err) {
      toast({
        title: 'Request failed',
        description: authService.getErrorMessage(err, 'Unable to send reset code. Please try again.'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
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
          <Mail className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold">Forgot password?</h2>
        <p className="mt-2 text-muted-foreground">
          Enter your email and we&apos;ll send you a 6-digit reset code.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="user@example.com" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</> : 'Send Reset Code'}
        </Button>

        <Button variant="ghost" className="w-full" asChild>
          <Link to="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Login</Link>
        </Button>
      </form>
    </motion.div>
  )
}
