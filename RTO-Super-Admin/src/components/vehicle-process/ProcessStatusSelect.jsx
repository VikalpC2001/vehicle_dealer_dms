import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * A dropdown of the dealer's custom statuses. The current process status is included
 * even if it isn't one of the dealer's statuses (e.g. the server-set "Pending").
 *
 * @param {object} props
 * @param {string} props.value - Current status string.
 * @param {Array<{statusId,statusName,colour}>} props.statuses
 * @param {(statusName: string) => void} props.onChange
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export function ProcessStatusSelect({ value, statuses = [], onChange, disabled, className }) {
  const names = statuses.map((s) => s.statusName)
  const items = []
  if (value && !names.includes(value)) items.push({ name: value, colour: null })
  statuses.forEach((s) => items.push({ name: s.statusName, colour: s.colour }))

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className || 'w-48'}>
        <SelectValue placeholder="Set status" />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.name} value={item.name}>
            <span className="flex items-center gap-2">
              {item.colour && (
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border"
                  style={{ backgroundColor: item.colour }}
                />
              )}
              {item.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
