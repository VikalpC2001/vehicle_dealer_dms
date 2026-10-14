import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const vehicleService = {
  /**
   * PATCH /vehicles/:id — FULL-REPLACE update of a vehicle. Every field must be sent; an omitted or
   * blank field nulls the stored value. `registrationNumber` is required (min 1); uniqueness excludes
   * self, so resending the unchanged number won't conflict. `manufactureMonth`/`manufactureYear` must
   * be numbers (or null). Callers build the complete body (see VehicleEditDialog).
   */
  async update(vehicleId, body) {
    const { data } = await api.patch(`/vehicles/${vehicleId}`, body)
    return unwrap(data)
  },
}
