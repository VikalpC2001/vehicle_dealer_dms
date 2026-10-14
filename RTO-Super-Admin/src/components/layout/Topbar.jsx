import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Menu, Sun, Moon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VehicleSearchBox } from '@/components/dashboard/VehicleSearchBox'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { accountRoutesForRole } from '@/lib/constants'
import { getInitials } from '@/lib/utils'

export function Topbar({ onMenuClick, sidebarOpen }) {
  const { toggleTheme, isDark } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)

  // Vehicle-process search exists for the two roles that work on processes; a super admin has no
  // process pages to open, so the header shows no search box for them.
  const searchSource = user?.role === 'dealer' || user?.role === 'agent' ? user.role : null
  const accountRoutes = accountRoutesForRole(user?.role)

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {searchSource && (
          <>
            <div className="hidden md:block w-72 lg:w-96">
              <VehicleSearchBox source={searchSource} compact autoFocus={false} />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Search vehicle processes"
            >
              <Search className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      <AnimatePresence>
        {searchSource && searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full border-b border-border bg-card p-4 md:hidden"
          >
            <VehicleSearchBox source={searchSource} compact onPicked={() => setSearchOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="gradient-bg text-white text-xs">
                  {getInitials(user?.name || 'SA')}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
            </DropdownMenuLabel>
            {accountRoutes && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(accountRoutes.profile)} className="cursor-pointer">Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(accountRoutes.settings)} className="cursor-pointer">Settings</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
