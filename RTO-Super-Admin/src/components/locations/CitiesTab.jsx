import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { CityFormDialog } from '@/components/locations/CityFormDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { TableToolbar, TableToolbarFilters, TableToolbarActions } from '@/components/tables/TableToolbar'
import { cityService, getCityId } from '@/services/cityService'
import { stateService, getStateId } from '@/services/stateService'
import { getErrorMessage } from '@/lib/authErrors'
import { PAGE_SIZE } from '@/lib/pagination'
import { toast } from '@/hooks/use-toast'

const CITY_PAGE_SIZE = PAGE_SIZE.location

function getCityStateId(city) {
  return city?.stateId ?? city?.state?.id ?? city?.state?._id
}

function getStateName(city, statesDdl) {
  if (city?.stateName) return city.stateName
  const id = getCityStateId(city)
  return statesDdl.find((state) => String(state.id) === String(id))?.stateName ?? '—'
}

export function CitiesTab() {
  const [page, setPage] = useState(1)
  const [filterStateId, setFilterStateId] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editCity, setEditCity] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const queryClient = useQueryClient()

  const { data: statesDdl = [], isLoading: ddlLoading } = useQuery({
    queryKey: ['states-ddl'],
    queryFn: () => stateService.getDdl(),
  })

  useEffect(() => {
    if (!filterStateId && statesDdl.length > 0) {
      setFilterStateId(String(statesDdl[0].id))
    }
  }, [statesDdl, filterStateId])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['cities', page, CITY_PAGE_SIZE, filterStateId],
    queryFn: () => cityService.getAll({ page, limit: CITY_PAGE_SIZE, stateId: filterStateId }),
    enabled: !!filterStateId,
  })

  const cities = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const createMutation = useMutation({
    mutationFn: cityService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] })
      toast({ title: 'City added', description: 'New city created successfully.', variant: 'success' })
      setFormOpen(false)
    },
    onError: (err) => toast({ title: 'Failed to add city', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => cityService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] })
      toast({ title: 'City updated', description: 'City saved successfully.', variant: 'success' })
      setEditCity(null)
    },
    onError: (err) => toast({ title: 'Failed to update city', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: cityService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] })
      toast({ title: 'City deleted', description: 'City has been removed.', variant: 'success' })
      setDeleteTarget(null)
      if (cities.length === 1 && page > 1) setPage((current) => current - 1)
    },
    onError: (err) => toast({ title: 'Failed to delete city', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const handleFilterChange = (value) => {
    setFilterStateId(value)
    setPage(1)
  }

  const columns = useMemo(
    () => [
      {
        label: '#',
        render: (_row, index) => (
          <span className="text-muted-foreground">{(page - 1) * CITY_PAGE_SIZE + index + 1}</span>
        ),
      },
      {
        key: 'cityName',
        label: 'City Name',
        render: (row) => <span className="font-semibold">{row.cityName}</span>,
      },
      {
        label: 'State',
        render: (row) => getStateName(row, statesDdl),
      },
      {
        label: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditCity(row)} aria-label="Edit city">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} aria-label="Delete city">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [page, statesDdl]
  )

  if (statesDdl.length === 0 && !ddlLoading) {
    return <EmptyState title="No states available" description="Add states first before managing cities." />
  }

  return (
    <div className="space-y-4">
      <TableToolbar>
        <TableToolbarFilters>
          <div className="space-y-2 w-full sm:w-72">
            <Label>Filter by State</Label>
            <Select
              value={filterStateId}
              onValueChange={handleFilterChange}
              disabled={ddlLoading || statesDdl.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {statesDdl.map((state) => (
                  <SelectItem key={state.id} value={String(state.id)}>
                    {state.stateName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TableToolbarFilters>
        <TableToolbarActions>
          <Button onClick={() => setFormOpen(true)} disabled={statesDdl.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Add City
          </Button>
        </TableToolbarActions>
      </TableToolbar>

      <DataTable
        mode="server"
        columns={columns}
        data={cities}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={CITY_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading || ddlLoading}
        isFetching={isFetching}
        itemLabel="cities"
        emptyTitle="No cities found"
        emptyDescription="Add a city for the selected state."
        showExport={false}
        selectable={false}
        getRowId={getCityId}
      />

      <CityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add City"
        description="Select a state and enter the city name."
        states={statesDdl}
        defaultValues={{ stateId: filterStateId, cityName: '' }}
        onSubmit={(values) => createMutation.mutateAsync(values)}
        loading={createMutation.isPending}
        submitLabel="Add City"
      />

      <CityFormDialog
        open={!!editCity}
        onOpenChange={(open) => !open && setEditCity(null)}
        title="Edit City"
        description={`Update city name for ${editCity?.cityName ?? 'city'}.`}
        states={statesDdl}
        defaultValues={{
          stateId: String(getCityStateId(editCity) ?? filterStateId),
          cityName: editCity?.cityName ?? '',
        }}
        onSubmit={(values) =>
          updateMutation.mutateAsync({
            id: getCityId(editCity),
            payload: { cityName: values.cityName },
          })
        }
        loading={updateMutation.isPending}
        submitLabel="Save Changes"
        lockState
      />

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete City"
        description={`Delete ${deleteTarget?.cityName}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getCityId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
