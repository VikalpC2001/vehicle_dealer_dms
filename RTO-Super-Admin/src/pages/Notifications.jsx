import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCheck, UserPlus, CreditCard, FileText, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { TableLoadingSkeleton } from '@/components/tables/TableLoadingSkeleton'
import { notificationService } from '@/services/notificationService'
import { formatDateTime, cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

const typeIcons = {
  registration: UserPlus,
  subscription: CreditCard,
  request: FileText,
  user: Shield,
  verification: CheckCheck,
}

export default function Notifications() {
  const [filter, setFilter] = useState('all')
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => notificationService.getAll(filter),
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationService.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'All marked as read', variant: 'success' })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">Stay updated on platform activity</p>
        </div>
        <Button variant="outline" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
          <CheckCheck className="mr-2 h-4 w-4" /> Mark All Read
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
        <TabsContent value={filter} className="mt-4">
          {isLoading ? (
            <TableLoadingSkeleton rows={5} />
          ) : notifications.length === 0 ? (
            <EmptyState title="No notifications" description="You're all caught up. New alerts will appear here." />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {notifications.map((notif, i) => {
                  const Icon = typeIcons[notif.type] || Bell
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card className={cn('transition-all hover:shadow-md cursor-pointer', !notif.read && 'border-primary/30 bg-primary/5')}>
                        <CardContent className="flex items-start gap-4 p-4">
                          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', notif.read ? 'bg-muted' : 'gradient-bg')}>
                            <Icon className={cn('h-5 w-5', notif.read ? 'text-muted-foreground' : 'text-white')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn('text-sm font-semibold', !notif.read && 'text-foreground')}>{notif.title}</p>
                              {!notif.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">{formatDateTime(notif.date)}</p>
                          </div>
                          {!notif.read && (
                            <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(notif.id)}>
                              Mark Read
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
