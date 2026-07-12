import { motion } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusesPanel } from '@/components/dealer-settings/StatusesPanel'
import { ReferencesPanel } from '@/components/dealer-settings/ReferencesPanel'
import { SubUsersPanel } from '@/components/dealer-settings/SubUsersPanel'
import { UploadConfigPanel } from '@/components/dealer-settings/UploadConfigPanel'
import { DealerProfilePanel } from '@/components/dealer-settings/DealerProfilePanel'

export default function DealerSettings() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your statuses, references, employees, documents, and profile</p>
      </motion.div>

      <Tabs defaultValue="statuses">
        <TabsList className="flex-wrap">
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="statuses" className="mt-4">
          <StatusesPanel />
        </TabsContent>
        <TabsContent value="references" className="mt-4">
          <ReferencesPanel />
        </TabsContent>
        <TabsContent value="employees" className="mt-4">
          <SubUsersPanel />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <UploadConfigPanel />
        </TabsContent>
        <TabsContent value="profile" className="mt-4">
          <DealerProfilePanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
