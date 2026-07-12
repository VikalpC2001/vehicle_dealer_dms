import api from '@/services/api'

/** Unwraps the `{ data: { ... } }` API envelope. */
function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const vehicleHistoryService = {
  /**
   * GET /vehicles/history?registrationNumber=<reg> — the dealer's buy/sell history for one
   * vehicle. The registration number is normalized server-side (spaces/case ignored).
   *
   * Rejects with a 404 (code 4047) when the dealer has never handled the vehicle; callers
   * should treat that rejection as "no history" rather than a hard error.
   *
   * @param {string} registrationNumber
   * @returns {Promise<{ vehicle: object, events: Array, summary: object, market: object }>}
   */
  async getHistory(registrationNumber) {
    const response = await api.get('/vehicles/history', { params: { registrationNumber } })
    const data = unwrap(response)
    return {
      vehicle: data?.vehicle ?? null,
      events: data?.events ?? [],
      summary: data?.summary ?? null,
      market: data?.market ?? null,
    }
  },
}
