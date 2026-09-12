import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { DataTable } from '@/components/tables/DataTable'
import { TableToolbar, TableToolbarActions } from '@/components/tables/TableToolbar'
import { DocumentCategoryFormDialog } from '@/components/forms/DocumentCategoryFormDialog'
import { uploadCategoryService, getUploadCategoryId } from '@/services/uploadCategoryService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/**
 * Super-admin management of the master document-category catalog (`UploadCategory`) — the document
 * types available across the platform, and their OCR **Extraction API** (inherited by dealers &
 * agents). Create / edit / delete.
 */
export default function DocumentCategories() {
  const [formOpen, setFormOpen] = useState(false)
  const [editCategory, setEditCategory] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const queryClient = useQueryClient()

  const { data: categories = [], isLoading, isFetching } = useQuery({
    queryKey: ['upload-categories'],
    queryFn: () => uploadCategoryService.getAll(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['upload-categories'] })

  const createMutation = useMutation({
    mutationFn: uploadCategoryService.create,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Document category added', variant: 'success' })
      setFormOpen(false)
    },
    onError: (err) => toast({ title: 'Failed to add', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => uploadCategoryService.update(id, payload),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Document category updated', variant: 'success' })
      setEditCategory(null)
    },
    onError: (err) => toast({ title: 'Failed to update', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: uploadCategoryService.remove,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Document category deleted', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Could not delete', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const columns = useMemo(
    () => [
      { label: '#', render: (_row, index) => <span className="text-muted-foreground">{index + 1}</span> },
      { key: 'categoryName', label: 'Category Name', render: (row) => <span className="font-semibold">{row.categoryName}</span> },
      {
        key: 'processApi',
        label: 'Extraction API',
        render: (row) =>
          row.processApi ? (
            <span className="font-mono text-xs">{row.processApi}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'bothSide',
        label: 'Both Sides',
        render: (row) => <Badge variant={row.bothSide ? 'success' : 'secondary'}>{row.bothSide ? 'Yes' : 'No'}</Badge>,
      },
      {
        label: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditCategory(row)} aria-label="Edit category">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} aria-label="Delete category">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Document Categories</h1>
        <p className="mt-1 text-muted-foreground">
          The master list of document types and their OCR extraction API — used by dealers &amp; agents.
        </p>
      </motion.div>

      <TableToolbar>
        <div />
        <TableToolbarActions>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </TableToolbarActions>
      </TableToolbar>

      <DataTable
        mode="client"
        columns={columns}
        data={categories}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="categories"
        emptyTitle="No document categories yet"
        emptyDescription="Add your first document category to get started."
        showExport={false}
        selectable={false}
        getRowId={getUploadCategoryId}
      />

      <DocumentCategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add Document Category"
        description="Create a document type (e.g. Buyer ID) and its optional extraction API."
        onSubmit={(values) => createMutation.mutateAsync(values)}
        loading={createMutation.isPending}
        submitLabel="Add Category"
      />

      <DocumentCategoryFormDialog
        open={!!editCategory}
        onOpenChange={(open) => !open && setEditCategory(null)}
        title="Edit Document Category"
        description={`Update ${editCategory?.categoryName ?? 'category'}.`}
        defaultValues={editCategory ?? undefined}
        onSubmit={(values) => updateMutation.mutateAsync({ id: getUploadCategoryId(editCategory), payload: values })}
        loading={updateMutation.isPending}
        submitLabel="Save Changes"
      />

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Document Category"
        description={`Delete "${deleteTarget?.categoryName}"? Dealers/agents using it will lose this document type.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getUploadCategoryId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
