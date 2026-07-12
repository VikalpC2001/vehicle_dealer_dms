import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'

export function EmptyState({ title = 'No data found', description = 'Try adjusting your search or filters.' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </motion.div>
  )
}
