import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Link2, Unlink, Loader2, Building2, Car } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { placeholderDealerService } from '@/services/placeholderDealerService'
import { dealerService } from '@/services/dealerService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

export default function AgentDealers() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: placeholders = [], isLoading } = useQuery({
    queryKey: ['placeholder-dealers'],
    queryFn: () => placeholderDealerService.getAll(),
  })

  const [addOpen, setAddOpen] = useState(false)
  const [addFirmName, setAddFirmName] = useState('')
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [connectTarget, setConnectTarget] = useState(null)
  const [connectDealerId, setConnectDealerId] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['placeholder-dealers'] })

  const createMutation = useMutation({
    mutationFn: () => placeholderDealerService.create({ firmName: addFirmName.trim() }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Placeholder added', variant: 'success' })
      setAddOpen(false)
      setAddFirmName('')
    },
    onError: (err) => toast({ title: 'Could not add placeholder', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const renameMutation = useMutation({
    mutationFn: () => placeholderDealerService.update(renameTarget.dealerId, { firmName: renameValue.trim() }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Placeholder renamed', variant: 'success' })
      setRenameTarget(null)
      setRenameValue('')
    },
    onError: (err) => toast({ title: 'Could not rename', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => placeholderDealerService.remove(deleteTarget.dealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Placeholder removed', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Could not remove', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const connectMutation = useMutation({
    mutationFn: () => placeholderDealerService.connect(connectTarget.dealerId, connectDealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Connected to dealer', variant: 'success' })
      setConnectTarget(null)
      setConnectDealerId('')
    },
    onError: (err) => toast({ title: 'Could not connect', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id) => placeholderDealerService.disconnect(id),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Disconnected', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not disconnect', description: getErrorMessage(err), variant: 'destructive' }),
  })

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Dealers</h1>
          <p className="text-muted-foreground mt-1">
            Placeholder dealers for firms not yet on the platform. Connect one to a real dealer when they join.
          </p>
        </div>
        <Button onClick={() => { setAddFirmName(''); setAddOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Add placeholder
        </Button>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Placeholder Dealers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : placeholders.length === 0 ? (
            <EmptyState
              title="No placeholder dealers yet"
              description="Add a placeholder for a dealer who hasn't joined the platform yet."
            />
          ) : (
            <div className="divide-y divide-border">
              {placeholders.map((ph) => {
                const connectedName = ph.connectedDealer?.firmName ?? ph.connectedDealer?.dealerName
                return (
                  <div key={ph.dealerId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{ph.firmName}</p>
                        {ph.dealerName && (
                          <p className="truncate text-xs text-muted-foreground">{ph.dealerName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(`/agent/dealers/${ph.dealerId}/vehicles`, {
                            state: { dealerName: ph.firmName },
                          })
                        }
                      >
                        <Car className="mr-1.5 h-4 w-4" /> Vehicles
                      </Button>
                      {ph.connectedDealerId ? (
                        <>
                          <Badge variant="success">
                            Connected → {connectedName ?? 'dealer'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectMutation.mutate(ph.dealerId)}
                            disabled={disconnectMutation.isPending}
                          >
                            <Unlink className="mr-1.5 h-4 w-4" /> Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setConnectDealerId(''); setConnectTarget(ph) }}
                        >
                          <Link2 className="mr-1.5 h-4 w-4" /> Connect
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setRenameValue(ph.firmName ?? ''); setRenameTarget(ph) }}
                        aria-label="Rename placeholder"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(ph)}
                        aria-label="Delete placeholder"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add placeholder */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add placeholder dealer</DialogTitle>
            <DialogDescription>A local stand-in for a dealer who hasn&apos;t joined the platform yet.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (addFirmName.trim()) createMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="firmName">Firm name</Label>
              <Input id="firmName" value={addFirmName} onChange={(e) => setAddFirmName(e.target.value)} placeholder="Firm name" />
            </div>
            <Button type="submit" className="w-full" disabled={!addFirmName.trim() || createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…</> : 'Add placeholder'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename placeholder */}
      <Dialog open={Boolean(renameTarget)} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename placeholder</DialogTitle>
            <DialogDescription>Update the firm name for this placeholder dealer.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (renameValue.trim()) renameMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="renameFirmName">Firm name</Label>
              <Input id="renameFirmName" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Firm name" />
            </div>
            <Button type="submit" className="w-full" disabled={!renameValue.trim() || renameMutation.isPending}>
              {renameMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Save changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Connect to real dealer */}
      <ConnectDialog
        target={connectTarget}
        onOpenChange={() => setConnectTarget(null)}
        value={connectDealerId}
        onValueChange={setConnectDealerId}
        onConfirm={() => connectMutation.mutate()}
        loading={connectMutation.isPending}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete placeholder dealer"
        description={`Remove ${deleteTarget?.firmName ?? 'this placeholder'}? This is blocked if it still has processes.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function ConnectDialog({ target, onOpenChange, value, onValueChange, onConfirm, loading }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dealers', 'connectable'],
    queryFn: () => dealerService.getAll({ page: 1, limit: 100 }),
    enabled: Boolean(target),
  })

  const options = useMemo(
    () => (data?.dealers ?? []).filter((d) => !d.isPlaceholder && d.isSubscribe === true),
    [data]
  )

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to a real dealer</DialogTitle>
          <DialogDescription>
            Link {target?.firmName ?? 'this placeholder'} to a subscribed dealer so your records merge with theirs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="realDealer">Subscribed dealer</Label>
          {isLoading ? (
            <Skeleton className="h-9 w-full rounded-md" />
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscribed dealers available to connect.</p>
          ) : (
            <Select value={value ?? ''} onValueChange={onValueChange}>
              <SelectTrigger id="realDealer">
                <SelectValue placeholder="Select a dealer" />
              </SelectTrigger>
              <SelectContent>
                {options.map((d) => (
                  <SelectItem key={d.dealerId} value={String(d.dealerId)}>
                    {d.firmName} {d.dealerName ? `(${d.dealerName})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!value || loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…</> : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
