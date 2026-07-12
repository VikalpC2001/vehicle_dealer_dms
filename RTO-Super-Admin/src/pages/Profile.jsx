import { motion } from 'framer-motion'
import { Mail, Shield, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { getInitials } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export default function Profile() {
  const { user } = useAuth()

  const handleSave = () => {
    toast({ title: 'Profile Updated', description: 'Your profile has been saved.', variant: 'success' })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your admin account</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="flex items-center gap-6 p-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="gradient-bg text-white text-2xl">{getInitials(user?.name || 'SA')}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{user?.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="capitalize">{user?.role?.replace('_', ' ')}</Badge>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{user?.email}</span>
                <span className="flex items-center gap-1"><Shield className="h-4 w-4" />Super Admin</span>
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />Since 2024</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader><CardTitle className="text-base">Edit Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Full Name</Label><Input defaultValue={user?.name} /></div>
            <div className="space-y-2"><Label>Email</Label><Input defaultValue={user?.email} type="email" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input defaultValue="+91 98765 43210" /></div>
            <div className="space-y-2"><Label>Department</Label><Input defaultValue="Administration" /></div>
          </div>
          <Button onClick={handleSave}>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  )
}
