import { mockRequests } from '@/data/mockData'

const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

let requests = [...mockRequests]

export const requestService = {
  async getAll(filters = {}) {
    await delay()
    let result = [...requests]
    if (filters.status && filters.status !== 'all') {
      result = result.filter((r) => r.status === filters.status)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(
        (r) => r.id.toLowerCase().includes(q) || r.userName.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
      )
    }
    return result
  },

  async updateStatus(id, status) {
    await delay()
    requests = requests.map((r) => (r.id === id ? { ...r, status } : r))
    return requests.find((r) => r.id === id)
  },

  async getPendingCount() {
    await delay(200)
    return requests.filter((r) => r.status === 'pending').length
  },
}
