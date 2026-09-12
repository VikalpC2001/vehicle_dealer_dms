import { useEffect, useRef, useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { registrationService } from '@/services/registrationService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/**
 * Reusable "verify your email" step: a 6-digit code input + resend. On success it calls
 * `onVerified(rawResponse)` with the raw `/auth/verify-otp` response so the caller can hydrate the
 * session (`applySession`) and route. Shared by registration (step 2) and the login recovery path
 * (a user who registered but never verified).
 *
 * @param {object} props
 * @param {string} props.email - The email to verify (code is sent here).
 * @param {(rawResponse: object) => void} props.onVerified
 * @param {boolean} [props.autoResend] - Send a fresh code on mount (login recovery). Register already sent one.
 * @param {() => void} [props.onBack]
 */
export function EmailOtpStep({ email, onVerified, autoResend = false, onBack }) {
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const sentRef = useRef(false)

  useEffect(() => {
    if (autoResend && !sentRef.current) {
      sentRef.current = true
      registrationService.resendOtp(email).catch(() => undefined)
    }
  }, [autoResend, email])

  const verify = async (e) => {
    e.preventDefault()
    if (otp.trim().length < 4) return
    setVerifying(true)
    try {
      const raw = await registrationService.verifyOtp(email, otp.trim())
      onVerified(raw)
    } catch (err) {
      toast({ title: 'Verification failed', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setVerifying(false)
    }
  }

  const resend = async () => {
    try {
      await registrationService.resendOtp(email)
      toast({ title: 'Code re-sent', description: 'Check your email for a new code.', variant: 'success' })
    } catch (err) {
      toast({ title: 'Could not resend', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">Verify your email</CardTitle>
        <CardDescription>Enter the 6-digit code sent to {email}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={verify} className="space-y-4">
          <div className="space-y-2">
            <Label>Verification code</Label>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="text-center text-lg tracking-[0.5em]"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={verifying || otp.trim().length < 4}>
            {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : 'Verify & continue'}
          </Button>
          <div className="flex items-center justify-between text-sm">
            {onBack ? (
              <button type="button" onClick={onBack} className="text-muted-foreground hover:underline">
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={resend} className="text-primary font-medium hover:underline">
              Resend code
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
