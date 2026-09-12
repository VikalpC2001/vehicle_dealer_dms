import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle, Store, UserCog } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { dealerService, getDealerId } from '@/services/dealerService'
import { agentService, getAgentId } from '@/services/agentService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

/** One subscribable party row with a live isSubscribe toggle (module-level → no remount churn). */
function SubscriptionRow({ name, sub, subscribed, pending, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={subscribed ? 'success' : 'secondary'}>
          {subscribed ? 'Subscribed' : 'Not subscribed'}
        </Badge>
        <Switch checked={subscribed} disabled={pending} onCheckedChange={onToggle} />
      </div>
    </div>
  )
}

/**
 * Super-admin subscription management. Toggling `isSubscribe` unlocks each party's capabilities:
 * a subscribed **dealer** gets the dealer site + can be a connect target; a subscribed **agent**
 * can independently manage their own placeholder dealers' vehicle data + ledger. (Billing is not
 * wired yet — this is the manual grant.)
 */
export default function Subscriptions() {
  const queryClient = useQueryClient()

  const { data: dealerData, isLoading: dealersLoading } = useQuery({
    queryKey: ['dealers', 'subscriptions'],
    queryFn: () => dealerService.getAll({ page: 1, limit: 100 }),
  })
  const { data: agentData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents', 'subscriptions'],
    queryFn: () => agentService.getAll({ page: 1, limit: 100 }),
  })

  const dealers = (dealerData?.dealers ?? []).filter((d) => !d.isPlaceholder)
  const agents = agentData?.agents ?? []

  const dealerMutation = useMutation({
    mutationFn: ({ id, isSubscribe }) => dealerService.setSubscription(id, isSubscribe),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['dealers'] })
      toast({ title: vars.isSubscribe ? 'Dealer subscribed' : 'Dealer unsubscribed', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not update', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const agentMutation = useMutation({
    mutationFn: ({ id, isSubscribe }) => agentService.setSubscription(id, isSubscribe),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast({ title: vars.isSubscribe ? 'Agent subscribed' : 'Agent unsubscribed', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not update', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const dealerActive = dealers.filter((d) => d.isSubscribe).length
  const agentActive = agents.filter((a) => a.isSubscribe).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground mt-1">Grant or revoke dealer and agent subscriptions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Subscribed dealers', count: `${dealerActive} / ${dealers.length}`, icon: Store },
          { label: 'Subscribed agents', count: `${agentActive} / ${agents.length}`, icon: UserCog },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <stat.icon className={cn('h-8 w-8 text-primary')} />
                <div>
                  <p className="text-2xl font-bold">{stat.count}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="dealers">
        <TabsList>
          <TabsTrigger value="dealers">Dealers</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="dealers">
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Store className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Dealers</CardTitle>
            </CardHeader>
            <CardContent>
              {dealersLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : dealers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dealers.</p>
              ) : (
                <div className="divide-y divide-border">
                  {dealers.map((d) => (
                    <SubscriptionRow
                      key={getDealerId(d)}
                      name={d.firmName || d.dealerName}
                      sub={d.emailId || d.mobileNo}
                      subscribed={Boolean(d.isSubscribe)}
                      pending={dealerMutation.isPending}
                      onToggle={(checked) => dealerMutation.mutate({ id: getDealerId(d), isSubscribe: checked })}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Agents</CardTitle>
            </CardHeader>
            <CardContent>
              {agentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents.</p>
              ) : (
                <div className="divide-y divide-border">
                  {agents.map((a) => (
                    <SubscriptionRow
                      key={getAgentId(a)}
                      name={a.firmName || a.agentName}
                      sub={a.emailId || a.mobileNo}
                      subscribed={Boolean(a.isSubscribe)}
                      pending={agentMutation.isPending}
                      onToggle={(checked) => agentMutation.mutate({ id: getAgentId(a), isSubscribe: checked })}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle className="h-3.5 w-3.5 text-success" />
        Subscriptions are granted manually here; payment/billing is not wired yet.
      </p>
    </div>
  )
}
