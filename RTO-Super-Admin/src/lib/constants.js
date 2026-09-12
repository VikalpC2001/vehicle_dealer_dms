export const APP_NAME = import.meta.env.VITE_APP_NAME || 'RTO Super Admin'

export const OTP_PURPOSE = {
  PASSWORD_RESET: 'PASSWORD_RESET',
}
export const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'rto_admin_token'
export const REFRESH_TOKEN_KEY = import.meta.env.VITE_REFRESH_TOKEN_KEY || 'rto_admin_refresh_token'

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  DEALER: 'dealer',
  AGENT: 'agent',
}

/**
 * Landing route for an app role. Used for post-login redirects and by `ProtectedRoute`
 * when bouncing a user out of a route group they may not enter. `'none'` (authenticated
 * but not a super-admin/dealer/agent) terminates at `/no-access` — never a gated route,
 * so there is no redirect loop.
 */
export function homeForRole(role) {
  if (role === 'agent') return '/agent/dashboard'
  if (role === 'dealer') return '/dealer/dashboard'
  if (role === 'super_admin') return '/dashboard'
  return '/no-access'
}

export const USER_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
}

export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  IN_PROGRESS: 'in_progress',
}

export const REQUEST_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
}

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
}

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Requests', path: '/requests', icon: 'Inbox' },
  { label: 'Dealers', path: '/dealers', icon: 'Store' },
  { label: 'Agents', path: '/agents', icon: 'UserCog' },
  { label: 'RTO Services', path: '/rto-services', icon: 'ClipboardList' },
  { label: 'Document Categories', path: '/document-categories', icon: 'FileStack' },
  { label: 'State & City', path: '/state-city', icon: 'MapPin' },
  { label: 'Users', path: '/users', icon: 'Users' },
  { label: 'Requests', path: '/requests', icon: 'FileText' },
  { label: 'Subscriptions', path: '/subscriptions', icon: 'CreditCard' },
  { label: 'Notifications', path: '/notifications', icon: 'Bell' },
  { label: 'Activity Logs', path: '/activity', icon: 'Activity' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
]

export const NAV_ITEMS_DEALER = [
  { label: 'Dashboard', path: '/dealer/dashboard', icon: 'LayoutDashboard' },
  { label: 'Vehicle Processes', path: '/dealer/processes', icon: 'Car' },
  { label: 'Task Board', path: '/dealer/board', icon: 'LayoutGrid' },
  { label: 'Task History', path: '/dealer/tasks/history', icon: 'CheckCheck' },
  { label: 'Vehicle History', path: '/dealer/vehicle-history', icon: 'History' },
  { label: 'Agents', path: '/dealer/agents', icon: 'UserCog', capability: 'agents.manage' },
  { label: 'Ledger', path: '/dealer/ledger', icon: 'BookOpen', capability: 'ledger.view' },
  { label: 'Roles & Permissions', path: '/dealer/roles', icon: 'ShieldCheck', capability: 'roles.manage' },
  { label: 'Settings', path: '/dealer/settings', icon: 'Settings' },
]

export const NAV_ITEMS_AGENT = [
  { label: 'Dashboard', path: '/agent/dashboard', icon: 'LayoutDashboard' },
  { label: 'Task Board', path: '/agent/board', icon: 'LayoutGrid' },
  { label: 'Assignments', path: '/agent/assignments', icon: 'ClipboardList' },
  { label: 'Dealers', path: '/agent/dealers', icon: 'Store' },
  { label: 'Ledger', path: '/agent/ledger', icon: 'BookOpen' },
  { label: 'Settings', path: '/agent/settings', icon: 'Settings' },
]

export const STATUS_COLORS = {
  active: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  suspended: 'bg-destructive/10 text-destructive border-destructive/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  approved: 'bg-success/10 text-success border-success/20',
  in_progress: 'bg-primary/10 text-primary border-primary/20',
  expiring: 'bg-warning/10 text-warning border-warning/20',
  expired: 'bg-destructive/10 text-destructive border-destructive/20',
  low: 'bg-muted text-muted-foreground border-border',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  urgent: 'bg-destructive text-white border-destructive',
}
