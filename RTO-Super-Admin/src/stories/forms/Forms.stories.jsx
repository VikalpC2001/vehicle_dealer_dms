import { useEffect } from 'react'
import { LoginForm } from '@/components/forms/LoginForm'
import { RegisterForm } from '@/components/forms/RegisterForm'
import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm'
import { VerifyOtpForm } from '@/components/forms/VerifyOtpForm'
import { ResetPasswordForm } from '@/components/forms/ResetPasswordForm'
import { usePasswordReset } from '@/context/PasswordResetContext'
import { withProviders } from '../helpers/StoryProviders'

const meta = {
  title: 'Forms/Auth',
  tags: ['autodocs'],
  decorators: [withProviders],
  parameters: {
    docs: {
      description: {
        component: 'Authentication forms using React Hook Form + Zod. Wrapped with app providers for Storybook.',
      },
    },
  },
}
export default meta

export const Login = {
  render: () => <LoginForm />,
  parameters: { layout: 'centered', route: '/login' },
}

export const Register = {
  render: () => <RegisterForm />,
  parameters: { layout: 'centered', route: '/register' },
}

export const ForgotPassword = {
  render: () => <ForgotPasswordForm />,
  parameters: { layout: 'centered', route: '/forgot-password' },
}

function VerifyOtpWithEmail() {
  const { setEmail } = usePasswordReset()
  useEffect(() => { setEmail('user@example.com') }, [setEmail])
  return <VerifyOtpForm />
}

export const VerifyOtp = {
  render: () => <VerifyOtpWithEmail />,
  parameters: { layout: 'centered', route: '/forgot-password/verify-otp' },
}

function ResetPasswordWithToken() {
  const { setEmail, setResetToken } = usePasswordReset()
  useEffect(() => {
    setEmail('user@example.com')
    setResetToken('storybook-mock-reset-token')
  }, [setEmail, setResetToken])
  return <ResetPasswordForm />
}

export const ResetPassword = {
  render: () => <ResetPasswordWithToken />,
  parameters: { layout: 'centered', route: '/forgot-password/reset' },
}
