import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const personService = {
  /** GET /persons?processId= — buyer/seller rows for a process, ordered by createdAt. */
  async getByProcess(processId) {
    const { data } = await api.get('/persons', { params: { processId } })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /persons — { processId, personName, mobileNumber, personType, address? }. */
  async create(payload) {
    const { data } = await api.post('/persons', payload)
    return unwrap(data)
  },

  /** PATCH /persons/:id — { personName, mobileNumber, personType, address? }. */
  async update(id, payload) {
    const { data } = await api.patch(`/persons/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /persons/:id. */
  async remove(id) {
    const { data } = await api.delete(`/persons/${id}`)
    return unwrap(data)
  },
}
