import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Tabs } from '@/components/ui/tabs'
import { AnimatedTabsList, AnimatedTabPanel } from '@/components/common/AnimatedTabs'
import { TaskStatusesPanel } from '@/components/dealer-settings/TaskStatusesPanel'
import { TaskTemplatesPanel } from '@/components/dealer-settings/TaskTemplatesPanel'
import { TagsPanel } from '@/components/vehicle-process/TagsPanel'
import { ReferencesPanel } from '@/components/dealer-settings/ReferencesPanel'
import { SubUsersPanel } from '@/components/dealer-settings/SubUsersPanel'
import { UploadConfigPanel } from '@/components/dealer-settings/UploadConfigPanel'
import { DealerProfilePanel } from '@/components/dealer-settings/DealerProfilePanel'

const TABS = [
  { value: 'tags', label: 'Tags' },
  { value: 'task-statuses', label: 'Task Statuses' },
  { value: 'task-templates', label: 'Job Templates' },
  { value: 'references', label: 'References' },
  { value: 'employees', label: 'Employees' },
  { value: 'documents', label: 'Documents' },
  { value: 'profile', label: 'Profile' },
]

export default function DealerSettings() {
  // The open tab is the `?tab=` query param (default `tags`), so a link can open a specific tab.
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const tab = TABS.some((t) => t.value === requested) ? requested : 'tags'
  const setTab = (value) => setSearchParams(value === 'tags' ? {} : { tab: value }, { replace: true })

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your tags, task board, job templates, references, employees, documents, and profile</p>
      </motion.div>

      {/* Manual activation: the tab can change from outside (header menu, Back), so focus landing on
          a tab must not switch to it — only click / Enter / Space does. */}
      <Tabs value={tab} onValueChange={setTab} activationMode="manual">
        <AnimatedTabsList tabs={TABS} value={tab} layoutId="dealer-settings-tab" />

        <AnimatedTabPanel value="tags">
          <TagsPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="task-statuses">
          <TaskStatusesPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="task-templates">
          <TaskTemplatesPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="references">
          <ReferencesPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="employees">
          <SubUsersPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="documents">
          <UploadConfigPanel />
        </AnimatedTabPanel>
        <AnimatedTabPanel value="profile">
          <DealerProfilePanel />
        </AnimatedTabPanel>
      </Tabs>
    </div>
  )
}
