import { ProcessBinList } from '@/components/vehicle-process/ProcessBinList'
import { vehicleProcessService } from '@/services/vehicleProcessService'

/**
 * Agent recycle bin — the caller agent's own soft-deleted processes across all placeholder dealers
 * they own. Processes stay here for 7 days and can be restored, after which they are auto-purged.
 */
export default function AgentBin() {
  return (
    <ProcessBinList
      title="Bin"
      description="Deleted processes are kept here for 7 days. Restore them or delete them permanently."
      binQueryKey={['vehicle-processes', 'agent-bin']}
      loadBin={({ page, limit }) => vehicleProcessService.getAgentBin({ page, limit })}
    />
  )
}
