import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tags, Check, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TagChip } from '@/components/vehicle-process/TagChip'
import { dealerTagService } from '@/services/dealerTagService'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { useAuth } from '@/context/AuthContext'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

function tagId(t) {
  return t?.tagId ?? t?.id
}

/**
 * Applies the dealer's Finder-style tags to a vehicle process. Renders the currently-selected tags
 * as chips next to a dropdown of all the dealer's tags (checkbox list); toggling stages a selection
 * and Save replaces the process's tag set via PUT /vehicle-processes/:id/tags, then invalidates the
 * process + list queries so they refresh.
 *
 * @param {object} props
 * @param {string} props.processId
 * @param {Array<{tagId:string, tagName:string, colour?:string}>} [props.value] - current tags
 * @param {string} [props.dealerId] - agent-managed dealer passthrough (dealer callers omit it)
 */
export function TagPicker({ processId, value = [], dealerId }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(() => new Set(value.map(tagId)))

  // Where the "no tags yet" link sends the user to define tags: dealers manage them in Settings;
  // agents manage a managed dealer's tags on that dealer's vehicle workspace (the "Manage tags" dialog).
  const isAgent = user?.role === 'agent'
  const manageTagsTo = isAgent
    ? dealerId
      ? `/agent/dealers/${dealerId}/vehicles`
      : '/agent/dealers'
    : '/dealer/settings'

  const { data: tags = [], isLoading } = useQuery({
    // Key on dealerId so an agent switching managed dealers doesn't reuse another dealer's tag list.
    queryKey: ['dealer-tags', dealerId ?? null],
    queryFn: () => dealerTagService.getAll(dealerId),
  })

  // Re-seed the staged selection from the server value each time the menu opens, so it always
  // reflects the latest saved tags (and discards any un-saved toggles from a previous open).
  const handleOpenChange = (next) => {
    if (next) setSelected(new Set(value.map(tagId)))
    setOpen(next)
  }

  const toggle = (id) =>
    setSelected((prev) => {
      const copy = new Set(prev)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })

  const saveMutation = useMutation({
    mutationFn: () => vehicleProcessService.setTags(processId, [...selected], dealerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-process', processId] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      // Agent surfaces that carry a denormalized copy of the process's tags.
      queryClient.invalidateQueries({ queryKey: ['agent-board-processes'] })
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] })
      toast({ title: 'Tags updated', variant: 'success' })
      setOpen(false)
    },
    onError: (err) => toast({ title: 'Could not update tags', description: getErrorMessage(err), variant: 'destructive' }),
  })

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.length > 0 ? (
        value.map((t) => <TagChip key={tagId(t)} name={t.tagName} colour={t.colour} />)
      ) : (
        <span className="text-sm text-muted-foreground">No tags</span>
      )}

      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7">
            <Tags className="mr-1.5 h-3.5 w-3.5" /> Edit tags
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-0">
          {isLoading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>
          ) : tags.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              <p>No tags defined yet.</p>
              <Link
                to={manageTagsTo}
                onClick={() => setOpen(false)}
                className="mt-1 inline-flex items-center text-primary hover:underline"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> {isAgent ? 'Manage tags for this dealer' : 'Create tags in Settings'}
              </Link>
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto p-1">
                {tags.map((t) => {
                  const id = tagId(t)
                  return (
                    <DropdownMenuCheckboxItem
                      key={id}
                      checked={selected.has(id)}
                      onCheckedChange={() => toggle(id)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <TagChip name={t.tagName} colour={t.colour} />
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </div>
              <div className="flex justify-end border-t border-border p-2">
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
                  ) : (
                    <><Check className="mr-1.5 h-3.5 w-3.5" /> Save</>
                  )}
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
