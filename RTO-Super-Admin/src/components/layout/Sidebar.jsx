import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, FileText, CreditCard, Bell, Activity, Settings, LogOut, Shield, Store, MapPin, Car, UserCog, BookOpen, LayoutGrid, ClipboardList, History,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { NAV_ITEMS, NAV_ITEMS_DEALER, NAV_ITEMS_AGENT, APP_NAME } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

const iconMap = {
  LayoutDashboard, Store, MapPin, Users, FileText, CreditCard, Bell, Activity, Settings, Car, UserCog, BookOpen, LayoutGrid, ClipboardList, History,
}

export function Sidebar({ collapsed, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const role = user?.role
  const navItems = role === 'agent' ? NAV_ITEMS_AGENT : role === 'dealer' ? NAV_ITEMS_DEALER : NAV_ITEMS
  const panelLabel = role === 'agent' ? 'Agent Panel' : role === 'dealer' ? 'Dealer Panel' : 'Super Admin Panel'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 0 : 280 }}
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card overflow-hidden',
        collapsed && 'pointer-events-none'
      )}
      style={{ width: collapsed ? 0 : 'var(--sidebar-width)' }}
    >
      <div className="flex h-[var(--topbar-height)] items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-bg">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">{APP_NAME}</h1>
          <p className="text-xs text-muted-foreground">{panelLabel}</p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon]
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'gradient-bg text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="gradient-bg text-white text-xs">
              {getInitials(user?.name || 'SA')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" className="mt-2 w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </motion.aside>
  )
}
