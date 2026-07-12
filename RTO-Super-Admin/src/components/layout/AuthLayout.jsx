import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Car, FileCheck, Users } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'

export function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-bg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link to="/login" className="flex items-center gap-3 w-fit">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
              <Shield className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold">{APP_NAME}</span>
          </Link>

          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="space-y-8"
          >
            <div>
              <h1 className="text-4xl font-bold leading-tight">
                Regional Transport Office<br />Management System
              </h1>
              <p className="mt-4 text-lg text-white/80 max-w-md">
                Streamline dealer and agent management with our enterprise-grade admin platform.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Car, label: 'Dealers' },
                { icon: Users, label: 'Agents' },
                { icon: FileCheck, label: 'Requests' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-xl bg-white/10 backdrop-blur p-4 text-center">
                  <Icon className="mx-auto h-6 w-6 mb-2" />
                  <p className="text-sm font-medium">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <p className="text-sm text-white/60">© 2024 RTO Super Admin. All rights reserved.</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6 md:p-12">
        {children}
      </div>
    </div>
  )
}
