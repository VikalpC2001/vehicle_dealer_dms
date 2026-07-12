import { motion } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AgentStatusesPanel } from '@/components/agent-settings/AgentStatusesPanel'
import { AgentSubUsersPanel } from '@/components/agent-settings/AgentSubUsersPanel'

export default function AgentSettings() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your RTO statuses, staff, and profile</p>
      </motion.div>

      <Tabs defaultValue="statuses">
        <TabsList className="flex-wrap">
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="statuses" className="mt-4">
          <AgentStatusesPanel />
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <AgentSubUsersPanel />
        </TabsContent>
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Profile editing is coming soon. For now, manage your statuses and staff from the other tabs.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
