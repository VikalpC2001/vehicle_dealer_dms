import { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Car, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { SearchInput } from '@/components/common/SearchInput'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { TagChip } from '@/components/vehicle-process/TagChip'
import { TagsPanel } from '@/components/vehicle-process/TagsPanel'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { dealerTagService } from '@/services/dealerTagService'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/lib/utils'

const ALL_TAGS = '__all__'

function tagIdOf(t) {
  return t?.tagId ?? t?.id
}

/**
 * Agent workspace: the vehicle processes for one dealer the agent manages (a placeholder they own,
 * or a connected/granted real dealer). Backed by `GET /vehicle-processes?dealerId=` (managed-dealer
 * scope). The agent can add a new process here (scoped to this dealer), filter by tag, and manage the
 * dealer's Finder-style tag master (the per-dealer labels shown on each row) via the "Manage tags"
 * dialog — mirroring how a dealer sees tags in their own vehicle list.
 */
export default function AgentDealerVehicles() {
  const { dealerId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const dealerName = state?.dealerName ?? 'Dealer'
  const [tagFilter, setTagFilter] = useState(ALL_TAGS)
  const [manageOpen, setManageOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput.trim(), 300)

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-processes', 'agent', dealerId, tagFilter, search],
    queryFn: () =>
      vehicleProcessService.getAll({
        dealerId,
        page: 1,
        limit: 100,
        search,
        tagId: tagFilter === ALL_TAGS ? undefined : tagFilter,
      }),
    enabled: Boolean(dealerId),
  })
  const processes = data?.processes ?? []

  const { data: tags = [] } = useQuery({
    queryKey: ['dealer-tags', dealerId ?? null],
    queryFn: () => dealerTagService.getAll(dealerId),
    enabled: Boolean(dealerId),
  })

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/agent/dealers')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to dealers
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{dealerName} — Vehicles</h1>
            <p className="text-muted-foreground mt-1">Vehicle/RTO processes you manage for this dealer.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <Tags className="mr-2 h-4 w-4" /> Manage tags
            </Button>
            <Button
              onClick={() =>
                navigate(`/agent/dealers/${dealerId}/vehicles/new`, { state: { dealerName } })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> New vehicle process
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Search + filter toolbar, sitting directly above the list. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by vehicle number or seller name"
          className="w-full sm:flex-1"
        />
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TAGS}>All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={tagIdOf(t)} value={tagIdOf(t)}>{t.tagName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Car className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Processes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : processes.length === 0 ? (
            <EmptyState
              title={
                search
                  ? 'No matching processes'
                  : tagFilter !== ALL_TAGS
                    ? 'No processes with this tag'
                    : 'No vehicle processes yet'
              }
              description={
                search
                  ? 'No processes match your search. Try a different vehicle number or seller name.'
                  : tagFilter !== ALL_TAGS
                    ? 'No processes carry this tag yet. Try another tag or clear the filter.'
                    : 'Add the first vehicle process for this dealer to start tracking RTO work.'
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {processes.map((p) => {
                const reg = p.vehicle?.registrationNumber || p.registrationNumber || 'Vehicle'
                const persons = p.persons?.length ?? 0
                const pid = getProcessId(p)
                const rowTags = p.tags ?? []
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() =>
                      navigate(`/agent/dealers/${dealerId}/vehicles/${pid}`, { state: { dealerName } })
                    }
                    className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{reg}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {persons} {persons === 1 ? 'party' : 'parties'}
                        {p.processDate ? ` · ${formatDate(p.processDate)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {rowTags.length > 0 ? (
                        rowTags.map((t) => <TagChip key={tagIdOf(t)} name={t.tagName} colour={t.colour} />)
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage the dealer's per-dealer tag master (the labels shown on each row / used to filter). */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage tags — {dealerName}</DialogTitle>
            <DialogDescription>
              Colored labels you can apply to this dealer&apos;s vehicle processes and filter the list by.
            </DialogDescription>
          </DialogHeader>
          <TagsPanel dealerId={dealerId} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
