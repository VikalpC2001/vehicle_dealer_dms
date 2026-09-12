import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import { useDebounce } from '@/hooks/useDebounce'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'

/**
 * A searchable vehicle-process picker backed by SERVER-SIDE search — not limited to a pre-loaded
 * page. Typing debounces into `GET /vehicle-processes?search=` (matches registration number + person
 * name); results populate a combobox. Stores the chosen `processId`, displays the registration number.
 *
 * @param {object} props
 * @param {string} props.value - Selected processId ('' = none).
 * @param {(processId: string) => void} props.onChange
 * @param {string} [props.dealerId] - Agent-managed dealer passthrough; a dealer caller omits it.
 * @param {string} [props.placeholder]
 * @param {string} [props.id]
 */
export function ProcessSearchSelect({ value, onChange, dealerId, placeholder = 'Search vehicle number…', id }) {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search.trim(), 300)

  const { data, isFetching } = useQuery({
    queryKey: ['vehicle-processes', 'task-picker', debounced, dealerId ?? null],
    queryFn: () => vehicleProcessService.getAll({ search: debounced, limit: 20, dealerId }),
    // Only search once something is typed — suggestions appear after you write, not before.
    enabled: debounced.length > 0,
  })

  const options = (data?.processes ?? []).map((p) => ({
    value: getProcessId(p),
    label: p.vehicle?.registrationNumber ?? p.registrationNumber ?? getProcessId(p),
  }))

  // Treat the debounce window (typed but not yet queried) as loading, so it shows "Searching…"
  // rather than briefly flashing "No vehicles found".
  const pending = isFetching || search.trim() !== debounced

  return (
    <SearchableSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      onSearch={setSearch}
      loading={pending}
      placeholder={placeholder}
      emptyText="No vehicles found"
    />
  )
}
