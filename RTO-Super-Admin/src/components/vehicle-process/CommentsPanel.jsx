import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, Loader2, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { useAuth } from '@/context/AuthContext'
import { commentsService } from '@/services/commentsService'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDateTime, cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

/** Colour treatment for the author-role badge. */
const ROLE_BADGE = {
  DEALER: 'border-primary/20 bg-primary/10 text-primary',
  AGENT: 'border-warning/20 bg-warning/10 text-warning',
  ADMIN: 'border-border bg-muted text-muted-foreground',
}

/** Initials for the author avatar bubble. */
function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

/** True when a comment was edited after posting (updatedAt meaningfully later than createdAt). */
function wasEdited(c) {
  if (!c.updatedAt || !c.createdAt) return false
  return new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000
}

/**
 * Shared, per-process comment thread — the dealer owner and the agent (assigned or managing) read
 * and post to the SAME thread. Anchored on `processId`; mounted on the dealer process detail, the
 * agent assignment detail, and the agent's own-process detail. Authors can edit/delete their own
 * comments; a super-admin can delete any (moderation).
 *
 * @param {object} props
 * @param {string} props.processId
 * @param {boolean} [props.fill] When true, the card fills its container height with an internally-
 *   scrolling message list and a pinned composer — for use inside a fixed-height container such as a
 *   modal. When false it renders normally (grows with content), so inline usages are unaffected.
 * @param {string} [props.className]
 */
export function CommentsPanel({ processId, fill = false, className }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const isSuperAdmin = user?.role === 'super_admin'

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['process-comments', processId],
    queryFn: () => commentsService.list(processId),
    enabled: Boolean(processId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['process-comments', processId] })

  const createMutation = useMutation({
    mutationFn: (body) => commentsService.create(processId, body),
    onSuccess: () => {
      setText('')
      invalidate()
    },
    onError: (err) =>
      toast({ title: 'Could not post comment', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ commentId, body }) => commentsService.update(processId, commentId, body),
    onSuccess: () => {
      setEditingId(null)
      setEditText('')
      invalidate()
    },
    onError: (err) =>
      toast({ title: 'Could not update comment', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId) => commentsService.remove(processId, commentId),
    onSuccess: () => {
      setDeleteTarget(null)
      invalidate()
      toast({ title: 'Comment deleted', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not delete comment', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || createMutation.isPending) return
    createMutation.mutate(body)
  }

  const startEdit = (c) => {
    setEditingId(c.commentId)
    setEditText(c.body)
  }

  const saveEdit = () => {
    const body = editText.trim()
    if (!body || updateMutation.isPending) return
    updateMutation.mutate({ commentId: editingId, body })
  }

  return (
    <Card className={cn(fill && 'flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <CardHeader className="flex-row items-center gap-2 space-y-0 shrink-0">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Comments ({comments.length})</CardTitle>
      </CardHeader>
      <CardContent className={cn('space-y-4', fill && 'flex min-h-0 flex-1 flex-col gap-4 space-y-0')}>
        <div className={cn(fill && 'min-h-0 flex-1 overflow-y-auto pr-1')}>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-2/3 rounded-lg" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Start the conversation below.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => {
              const mine = c.authorUserId && user?.id && c.authorUserId === user.id
              const editing = editingId === c.commentId
              return (
                <li key={c.commentId} className={cn('group flex gap-2.5', mine && 'flex-row-reverse')}>
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      mine ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {initials(c.authorName)}
                  </div>
                  <div className={cn('flex min-w-0 flex-col gap-1', mine && 'items-end', editing ? 'w-full' : 'max-w-[85%]')}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-xs font-medium">{mine ? 'You' : c.authorName || 'Unknown'}</span>
                      <Badge
                        variant="outline"
                        className={cn('px-1.5 py-0 text-[10px] font-medium', ROLE_BADGE[c.authorRole] ?? ROLE_BADGE.ADMIN)}
                      >
                        {c.authorRole}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                      {wasEdited(c) && <span className="text-[11px] text-muted-foreground">(edited)</span>}
                    </div>

                    {editing ? (
                      <div className="w-full space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          maxLength={2000}
                          autoFocus
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveEdit()
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={!editText.trim() || updateMutation.isPending}>
                            {updateMutation.isPending ? (
                              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</>
                            ) : (
                              'Save'
                            )}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={updateMutation.isPending}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'w-fit whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                          mine
                            ? 'rounded-tr-sm bg-primary text-primary-foreground'
                            : 'rounded-tl-sm bg-muted text-foreground',
                        )}
                      >
                        {c.body}
                      </div>
                    )}

                    {(mine || isSuperAdmin) && !editing && (
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                        {mine && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => startEdit(c)}
                            aria-label="Edit comment"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setDeleteTarget(c)}
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        </div>

        <form onSubmit={handleSubmit} className={cn('space-y-2 border-t border-border pt-4', fill && 'shrink-0')}>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment…"
            rows={2}
            maxLength={2000}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter to send.
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e)
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!text.trim() || createMutation.isPending}>
              {createMutation.isPending ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Posting…</>
              ) : (
                <><Send className="mr-1.5 h-4 w-4" /> Comment</>
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete comment"
        description="This permanently removes the comment for everyone on this thread. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.commentId)}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
