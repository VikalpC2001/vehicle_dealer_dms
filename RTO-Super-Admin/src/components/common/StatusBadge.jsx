import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={cn('capitalize', STATUS_COLORS[status] || '')}>
      {status?.replace('_', ' ')}
    </Badge>
  )
}
