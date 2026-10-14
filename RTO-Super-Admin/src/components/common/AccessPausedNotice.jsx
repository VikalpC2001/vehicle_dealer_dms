import { useNavigate } from 'react-router-dom'
import { AccessPausedDialog } from '@/components/modals/AccessPausedDialog'
import { useAuth } from '@/context/AuthContext'

/**
 * App-wide host for the "Access paused" popup. Mounted once inside the router (outside `<Routes>`)
 * so it shows on every route, `/login` included. The page the user was on stays behind the popup;
 * only clicking OK signs them out of it and lands on `/login`.
 */
export function AccessPausedNotice() {
  const { pausedNotice, dismissPausedNotice } = useAuth()
  const navigate = useNavigate()

  const handleConfirm = () => {
    dismissPausedNotice()
    navigate('/login', { replace: true })
  }

  return <AccessPausedDialog open={!!pausedNotice} message={pausedNotice?.message} onConfirm={handleConfirm} />
}
