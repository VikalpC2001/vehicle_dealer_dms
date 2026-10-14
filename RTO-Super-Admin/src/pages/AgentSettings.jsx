import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Tabs } from '@/components/ui/tabs'
import { AnimatedTabsList, AnimatedTabPanel } from '@/components/common/AnimatedTabs'
import { AgentStatusesPanel } from '@/components/agent-settings/AgentStatusesPanel'
import { AgentSubUsersPanel } from '@/components/agent-settings/AgentSubUsersPanel'
import { AgentUploadConfigPanel } from '@/components/agent-settings/AgentUploadConfigPanel'
import { AgentProfilePanel } from '@/components/agent-settings/AgentProfilePanel'

const TABS = [
  { value: 'statuses', label: 'Statuses' },
  { value: 'staff', label: 'Staff' },
  { value: 'documents', label: 'Documents' },
  { value: 'profile', label: 'Profile' },
]

export default function AgentSettings() {
  // The open tab is the `?tab=` query param (default `statuses`), so a link can open a specific tab.
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const tab = TABS.some((t) => t.value === requested) ? requested : 'statuses'
  const setTab = (value) => setSearchParams(value === 'statuses' ? {} : { tab: value }, { replace: true })

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your RTO statuses, staff, and profile</p>
      </motion.div>

      {/* Manual activation: the tab can change from outside (header menu, Back), so focus landing on
          a tab must not switch to it — only click / Enter / Space does. */}
      <Tabs value={tab} onValueChange={setTab} activationMode="manual">
        <AnimatedTabsList tabs={TABS} value={tab} layoutId="agent-settings-tab" />

        <AnimatedTabPanel value="statuses">
          <AgentStatusesPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="staff">
          <AgentSubUsersPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="documents">
          <AgentUploadConfigPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="profile">
          <AgentProfilePanel />
        </AnimatedTabPanel>
      </Tabs>
    </div>
  )
}
