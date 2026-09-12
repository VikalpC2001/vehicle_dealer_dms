import { useQuery } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { stateService } from '@/services/stateService'
import { cityService } from '@/services/cityService'

/**
 * Cascading State → City dropdowns backed by the `/states/ddl` + `/cities/ddl/:stateId` APIs.
 *
 * Stores/emits the NAME strings (what Dealer/Agent records keep in their `state`/`city` columns),
 * while resolving the selected state's id internally to load its cities. A stored value that isn't
 * in the API list (legacy free-text) is still shown as a selectable option so nothing is lost.
 *
 * @param {object} props
 * @param {string} [props.stateValue] - Current state NAME.
 * @param {string} [props.cityValue] - Current city NAME.
 * @param {(name: string) => void} props.onStateChange
 * @param {(name: string) => void} props.onCityChange
 * @param {string} [props.stateError]
 * @param {string} [props.cityError]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.required]
 */
export function StateCitySelect({
  stateValue = '',
  cityValue = '',
  onStateChange,
  onCityChange,
  stateError,
  cityError,
  disabled = false,
  required = false,
}) {
  const { data: states = [], isLoading: statesLoading } = useQuery({
    queryKey: ['states-ddl'],
    queryFn: () => stateService.getDdl(),
  })

  const selectedStateId = states.find((s) => s.stateName === stateValue)?.id ?? null

  const { data: cities = [] } = useQuery({
    queryKey: ['cities-ddl', selectedStateId],
    queryFn: () => cityService.getDdl(selectedStateId),
    enabled: Boolean(selectedStateId),
  })

  // Preserve a stored value that isn't in the fetched options (legacy free-text) by offering it too.
  const stateOutOfList = stateValue && !states.some((s) => s.stateName === stateValue)
  const cityOutOfList = cityValue && !cities.some((c) => c.cityName === cityValue)

  const req = required ? <span className="text-destructive"> *</span> : null

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="state">State{req}</Label>
        <Select
          value={stateValue || undefined}
          onValueChange={(v) => {
            onStateChange(v)
            // Changing state invalidates the previously chosen city.
            if (v !== stateValue) onCityChange('')
          }}
          disabled={disabled || statesLoading}
        >
          <SelectTrigger id="state">
            {/* Render the selected NAME directly: Radix's <SelectValue> can't show a controlled
                value whose item was never mounted (dropdown never opened), which left the trigger
                blank after returning to the page. */}
            {stateValue ? (
              <span className="truncate">{stateValue}</span>
            ) : (
              <SelectValue placeholder={statesLoading ? 'Loading…' : 'Select state'} />
            )}
          </SelectTrigger>
          <SelectContent>
            {stateOutOfList && <SelectItem value={stateValue}>{stateValue}</SelectItem>}
            {states.map((s) => (
              <SelectItem key={s.id} value={s.stateName}>
                {s.stateName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stateError && <p className="text-sm text-destructive">{stateError}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">City{req}</Label>
        <Select
          value={cityValue || undefined}
          onValueChange={(v) => onCityChange(v)}
          disabled={disabled || !stateValue}
        >
          <SelectTrigger id="city">
            {cityValue ? (
              <span className="truncate">{cityValue}</span>
            ) : (
              <SelectValue placeholder={stateValue ? 'Select city' : 'Select a state first'} />
            )}
          </SelectTrigger>
          <SelectContent>
            {cityOutOfList && <SelectItem value={cityValue}>{cityValue}</SelectItem>}
            {cities.map((c) => (
              <SelectItem key={c.id} value={c.cityName}>
                {c.cityName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cityError && <p className="text-sm text-destructive">{cityError}</p>}
      </div>
    </>
  )
}
