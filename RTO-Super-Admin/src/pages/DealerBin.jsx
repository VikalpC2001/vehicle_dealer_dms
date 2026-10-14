import { ProcessBinList } from '@/components/vehicle-process/ProcessBinList'
import { vehicleProcessService } from '@/services/vehicleProcessService'

/**
 * Dealer recycle bin — soft-deleted vehicle processes for the caller's dealer (token-scoped).
 * Processes stay here for 7 days and can be restored, after which they are auto-purged.
 */
export default function DealerBin() {
  return (
    <ProcessBinList
      title="Bin"
      description="Deleted processes are kept here for 7 days. Restore them or delete them permanently."
      binQueryKey={['vehicle-processes', 'bin']}
      loadBin={({ page, limit }) => vehicleProcessService.getBin({ page, limit })}
    />
  )
}
