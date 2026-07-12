import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { APP_NAME } from '@/lib/constants'

export default function Settings() {
  const [brandName, setBrandName] = useState(APP_NAME)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [twoFactor, setTwoFactor] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState('30')

  const handleSave = () => {
    toast({ title: 'Settings Saved', description: 'Your preferences have been updated.', variant: 'success' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your platform configuration</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">General Settings</CardTitle>
                <CardDescription>Configure basic platform information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Brand Name</Label>
                  <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input defaultValue="support@rto.gov.in" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Default Timezone</Label>
                  <Input defaultValue="Asia/Kolkata" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Settings</CardTitle>
              <CardDescription>Configure SMTP and email templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>SMTP Host</Label><Input defaultValue="smtp.rto.gov.in" /></div>
                <div className="space-y-2"><Label>SMTP Port</Label><Input defaultValue="587" /></div>
                <div className="space-y-2"><Label>From Email</Label><Input defaultValue="noreply@rto.gov.in" /></div>
                <div className="space-y-2"><Label>From Name</Label><Input defaultValue="RTO Admin" /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Settings</CardTitle>
              <CardDescription>Control how you receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: 'Email Notifications', desc: 'Receive email alerts for important events', value: emailNotifications, onChange: setEmailNotifications },
                { label: 'Push Notifications', desc: 'Browser push notifications for real-time updates', value: pushNotifications, onChange: setPushNotifications },
                { label: 'New Registration Alerts', desc: 'Notify when new dealers or agents register', value: true, onChange: () => {} },
                { label: 'Subscription Expiry Alerts', desc: 'Alert before subscriptions expire', value: true, onChange: () => {} },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.onChange} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security Settings</CardTitle>
              <CardDescription>Protect your admin account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Input value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} type="number" className="w-32" />
              </div>
              <div className="space-y-2">
                <Label>Change Password</Label>
                <Input type="password" placeholder="New password" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Preferences</CardTitle>
              <CardDescription>Platform-wide configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>API Base URL</Label><Input defaultValue={import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'} /></div>
              <div className="space-y-2"><Label>Max Login Attempts</Label><Input defaultValue="5" type="number" className="w-32" /></div>
              <div className="space-y-2"><Label>Data Retention (days)</Label><Input defaultValue="365" type="number" className="w-32" /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave}>
        <Save className="mr-2 h-4 w-4" /> Save Settings
      </Button>
    </div>
  )
}
