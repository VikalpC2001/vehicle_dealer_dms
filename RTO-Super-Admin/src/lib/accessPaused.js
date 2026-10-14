import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '@/lib/constants'
import { getErrorCode } from '@/lib/authErrors'

/**
 * Forced sign-out for a firm whose access the super admin has paused. The backend answers a paused
 * dealer/agent with HTTP 403 + app code 4022 on every guarded route, on sign-in and on token refresh.
 *
 * Kept in `lib/` so the axios interceptor (`services/api.js`) and `AuthContext` can share it without
 * a circular import: the interceptor calls `forceAccessPausedSignOut`, the context listens through
 * `subscribeAccessPaused` and shows the "Access paused" popup.
 */

export const ACCESS_PAUSED_CODE = 4022
export const ACCESS_PAUSED_MESSAGE = 'Your account access has been paused. Please contact the super admin.'

const NOTICE_KEY = 'rto_admin_access_paused'
const EVENT_NAME = 'rto:access-paused'
const CHANNEL_NAME = 'rto_admin_access_paused'

let channel // undefined = not created yet, null = BroadcastChannel unavailable

// One shared instance per tab for both posting and listening: a BroadcastChannel never delivers a
// message to the instance that posted it, so this tab is not told twice (window event + channel).
function getChannel() {
  if (channel === undefined) {
    try {
      channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null
    } catch {
      channel = null
    }
  }
  return channel
}

function toNotice(message) {
  return { message: typeof message === 'string' && message.trim() ? message : ACCESS_PAUSED_MESSAGE }
}

/** True when an axios error is the "firm paused" error (HTTP 403 AND app code 4022). */
export function isAccessPausedError(error) {
  return error?.response?.status === 403 && getErrorCode(error) === ACCESS_PAUSED_CODE
}

// Saves the notice for this tab and raises the popup. `signedOut` tells the listener whether the
// stored session was wiped (so it must drop the in-memory user too).
function announce(notice, signedOut) {
  // sessionStorage: the popup must survive a reload of this tab (the interceptor's hard redirect
  // or a manual refresh) without leaking into tabs opened later.
  try {
    sessionStorage.setItem(NOTICE_KEY, JSON.stringify(notice))
  } catch {
    // storage full or blocked — the popup still shows, it just won't survive a reload
  }

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ...notice, signedOut } }))
}

/**
 * Raises the "Access paused" popup WITHOUT touching the stored session. For a refused sign-in
 * (`/auth/login` etc.): that 4022 is about the submitted credentials, and the session stored in
 * this browser may belong to someone else (e.g. the super admin testing a paused dealer's login).
 *
 * @param {string} [message] - Server message; falls back to `ACCESS_PAUSED_MESSAGE`.
 */
export function announceAccessPaused(message) {
  announce(toNotice(message), false)
}

/**
 * Wipes the stored session (tokens in both storages + the stored user) and announces the pause:
 * to this tab through a window event and, unless `broadcast` is false, to the user's other tabs.
 *
 * @param {string} [message] - Server message; falls back to `ACCESS_PAUSED_MESSAGE`.
 * @param {{ broadcast?: boolean }} [opts]
 */
export function forceAccessPausedSignOut(message, { broadcast = true } = {}) {
  const notice = toNotice(message)

  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(TOKEN_KEY)
    storage.removeItem(REFRESH_TOKEN_KEY)
  }
  localStorage.removeItem(USER_KEY)

  announce(notice, true)

  if (broadcast) {
    try {
      getChannel()?.postMessage(notice)
    } catch {
      // other tabs find out on their own next request
    }
  }
}

/** The notice left by a forced sign-out in this tab (`{ message }`), or null. */
export function readAccessPausedNotice() {
  try {
    const stored = sessionStorage.getItem(NOTICE_KEY)
    return stored ? toNotice(JSON.parse(stored)?.message) : null
  } catch {
    return null
  }
}

export function clearAccessPausedNotice() {
  sessionStorage.removeItem(NOTICE_KEY)
}

/** True while this tab's "Access paused" popup is waiting for the user to confirm it. */
export function isAccessPausedPending() {
  try {
    return sessionStorage.getItem(NOTICE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Listens for pause announcements. `onPaused(notice, { signedOut })` fires for an announcement in
 * this tab (`signedOut` = the stored session was wiped), `onPausedElsewhere(notice)` when another
 * tab of this browser was signed out. Returns an unsubscribe.
 *
 * @param {{ onPaused?: (notice: { message: string }, info: { signedOut: boolean }) => void, onPausedElsewhere?: (notice: { message: string }) => void }} listeners
 */
export function subscribeAccessPaused({ onPaused, onPausedElsewhere }) {
  const handleEvent = (event) =>
    onPaused?.(toNotice(event.detail?.message), { signedOut: event.detail?.signedOut !== false })
  const handleMessage = (event) => onPausedElsewhere?.(toNotice(event.data?.message))
  const tabs = getChannel()

  window.addEventListener(EVENT_NAME, handleEvent)
  tabs?.addEventListener('message', handleMessage)

  return () => {
    window.removeEventListener(EVENT_NAME, handleEvent)
    tabs?.removeEventListener('message', handleMessage)
  }
}
