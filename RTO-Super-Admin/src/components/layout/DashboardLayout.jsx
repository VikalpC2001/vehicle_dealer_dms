import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { PageTransition } from '@/components/common/PageTransition'
import { cn } from '@/lib/utils'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar collapsed={false} />
      </div>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 z-40 lg:hidden">
            <Sidebar collapsed={false} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <div className={cn('flex flex-col transition-all duration-300 lg:ml-[var(--sidebar-width)]')}>
        <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {/* Enter only, keyed on the path: the old page unmounts at once and the new one mounts once.
              Do not wrap this in <AnimatePresence> for an exit: <Outlet /> inside the exiting wrapper
              renders the NEW route, so every page mounted twice and, in a production build, a page
              with animated tabs stayed invisible. */}
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
