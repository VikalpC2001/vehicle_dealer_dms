// Fixed vehicle-process lifecycle statuses (mirrors the backend `VehicleProcessStatus` enum).
// A process starts with no status (OPEN); the dealer sets one of these later.

export const PROCESS_STATUSES = [
  { value: 'SOLD', label: 'Sold', colour: '#3b82f6' },
  { value: 'COMPLETE', label: 'Complete', colour: '#22c55e' },
  { value: 'SCRAP', label: 'Scrap', colour: '#ef4444' },
]

/** Enum value → display label. */
export const PROCESS_STATUS_LABEL = PROCESS_STATUSES.reduce((m, s) => {
  m[s.value] = s.label
  return m
}, {})

/** Enum value → dot colour. */
export const PROCESS_STATUS_COLOUR = PROCESS_STATUSES.reduce((m, s) => {
  m[s.value] = s.colour
  return m
}, {})
