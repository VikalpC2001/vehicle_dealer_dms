import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { RegisterForm } from '@/components/forms/RegisterForm'
import { useAuth } from '@/context/AuthContext'
import { APP_NAME } from '@/lib/constants'
import { Link } from 'react-router-dom'

export default function Register() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <Link to="/login" className="inline-flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-bg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">{APP_NAME}</span>
        </Link>
      </motion.div>
      <div className="w-full max-w-2xl">
        <RegisterForm />
      </div>
    </div>
  )
}
