import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/context/AuthContext'
import { toast } from '@/hooks/use-toast'
import { getPasswordStrength } from '@/lib/utils'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  mobile: z.string().min(10, 'Please enter a valid mobile number'),
  companyName: z.string().min(2, 'Company name is required'),
  role: z.enum(['dealer', 'agent'], { required_error: 'Please select a role' }),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  const { register: registerUser, loading } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: '' },
  })

  const password = watch('password', '')
  const strength = getPasswordStrength(password)

  const onSubmit = async (data) => {
    try {
      await registerUser(data)
      setSuccess(true)
      toast({ title: 'Registration submitted', description: 'Your account is pending admin approval.', variant: 'success' })
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' })
    }
  }

  if (success) {
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12">
        <CheckCircle2 className="mx-auto h-16 w-16 text-success mb-4" />
        <h2 className="text-2xl font-bold">Registration Successful!</h2>
        <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-0 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Register as a Dealer or Agent</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="John Doe" {...register('fullName')} />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="john@company.com" {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input placeholder="+91 98765 43210" {...register('mobile')} />
                {errors.mobile && <p className="text-sm text-destructive">{errors.mobile.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input placeholder="Your Company" {...register('companyName')} />
                {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select onValueChange={(v) => setValue('role', v)}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dealer">Dealer</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} placeholder="Create password" {...register('password')} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
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
                <Label>Confirm Password</Label>
                <Input type="password" placeholder="Confirm password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Create Account'}
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
